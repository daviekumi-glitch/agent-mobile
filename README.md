# Agent Mobile

A ChatGPT-style AI chat application with **skills and tools** built into the conversation.
Next.js 15 (App Router) | TypeScript | Tailwind CSS | shadcn/ui | Supabase | streaming responses.

---

## What it does

| Capability | Detail |
|---|---|
| **Streaming chat** | Token-by-token NDJSON stream from `/api/chat`, rendered live |
| **Markdown + code** | GitHub-flavoured Markdown, syntax highlighting, per-block copy buttons |
| **Message actions** | Regenerate, edit & resend, copy, delete, per-message timestamps |
| **Response variants** | Regenerating keeps previous answers -- switch between them with `< 2/3 >` |
| **Slash commands** | Type `/` in the composer for tools, skills and actions |
| **User settings** | Per-user default model and a standing custom instruction |
| **In-thread search** | Cmd+F / Ctrl+F search with match navigation and highlighting |
| **Export** | Download the thread as Markdown or JSON, or copy the transcript |
| **Tool calling** | The model calls tools mid-turn; each call renders as an expandable card |
| **Skills panel** | Toggle individual tools or whole skill bundles per chat |
| **Model picker** | Switch between GPT-4o / 4.1 / o4-mini per conversation |
| **Attachments** | Upload images, PDFs, CSV, markdown, source files (Supabase Storage) |
| **Conversation history** | Sidebar with search, pin, rename, archive, delete, time-bucketed grouping |
| **Auth** | Supabase email/password with SSR cookie sessions and route guards |
| **Theming** | Light / dark / system, custom design tokens, mobile-first responsive |
| **Security** | Row Level Security on every table, owner-scoped queries throughout |

### Built-in tools

| Tool | Skill | Requires |
|---|---|---|
| `web_search` | Web Research | `TAVILY_API_KEY` |
| `get_weather` | Web Research | `OPENWEATHER_API_KEY` |
| `calculator` | Math & Data | -- |
| `run_code` | Code Execution | `ENABLE_CODE_EXECUTION=1` |
| `generate_image` | Image Generation | `OPENAI_API_KEY` |
| `read_file` | File Reading | -- |
| `get_current_time` | Utilities | -- |

Tools whose env var is missing are shown as **disabled** in the panel rather than
silently failing -- the model is told the tool is unavailable and answers without it.

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/daviekumi-glitch/agent-mobile.git
cd agent-mobile
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the migrations in order:
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) then
   [`supabase/migrations/0002_profile_preferences.sql`](supabase/migrations/0002_profile_preferences.sql).
   Together these create the tables, indexes, triggers, RLS policies, the
   `attachments` storage bucket, and the per-user preference columns.

   *Or, with the Supabase CLI:*

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

3. In **Authentication > Providers**, make sure **Email** is enabled.
   For local development, turn **Confirm email** off so signup logs you straight in.

### 3. Configure environment

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key (RLS still applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only privileged key -- never expose |
| `OPENAI_API_KEY` | yes | LLM provider key |
| `OPENAI_BASE_URL` | no | Point at any OpenAI-compatible gateway |
| `TAVILY_API_KEY` | no | Enables the `web_search` tool |
| `OPENWEATHER_API_KEY` | no | Enables the `get_weather` tool |
| `ENABLE_CODE_EXECUTION` | no | `1` enables the `run_code` tool |
| `NEXT_PUBLIC_SITE_URL` | no | Canonical URL, used for auth redirects |
| `NEXT_PUBLIC_APP_URL` | no | URL the packaged Android app loads |

### 4. Run

```bash
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build
npm run start        # serve the production build
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm test             # vitest -- unit tests for pure logic
npm run test:watch   # vitest in watch mode
npm run test:e2e     # playwright -- app shell + chat flow
```

---

## Architecture

```
src/
  app/
    api/
      chat/route.ts               # streaming chat + tool-calling loop
      conversations/route.ts      # list / create
      conversations/[id]/route.ts # get / patch / delete
      messages/[id]/route.ts      # delete a single message
      profile/route.ts            # get / patch user preferences
      tools/route.ts              # model + skill + tool metadata
      upload/route.ts             # attachment upload -> Storage
    auth/callback/route.ts        # OAuth / email code exchange
    chat/page.tsx                 # protected chat route
    login/ , register/            # auth pages
    layout.tsx , page.tsx         # shell + landing
    globals.css                   # design tokens + prose + hljs theme
  components/
    chat/
      chat-shell.tsx              # layout composition
      sidebar.tsx                 # history, search, pin, rename, delete
      message-thread.tsx          # auto-scroll + in-thread search
      message-bubble.tsx          # user/assistant bubbles + actions
      variant-switcher.tsx        # < 2/3 > response variant control
      slash-command-palette.tsx   # `/` command palette
      settings-dialog.tsx         # default model + custom instruction
      markdown.tsx                # markdown + copyable code blocks
      tool-call-card.tsx          # expandable tool-call card
      composer.tsx                # input, attachments, send/stop
      model-picker.tsx            # model switcher
      tools-panel.tsx             # skills & tools configuration
      empty-state.tsx             # designed empty state + suggestions
    native/
      native-shell.tsx            # Capacitor shell gate
      app-url-setup.tsx           # first-run backend URL prompt
    auth/auth-form.tsx
    ui/                           # shadcn-style primitives
  lib/
    ai/client.ts                  # OpenAI client + model registry
    tools/registry.ts             # tool/skill definitions + JSON schemas
    tools/executor.ts             # server-side tool implementations
    tools/calculator.ts           # safe arithmetic evaluator (no eval)
    tools/weather.ts              # weather response mapper
    export.ts                     # Markdown / JSON conversation export
    commands.ts                   # slash-command table + matcher
    variants.ts                   # variant grouping (pure)
    mobile/app-url.ts             # native URL resolution
    mobile/preferences.ts         # persisted client preferences
    mobile/nav.ts                 # external link handling
    store/chat-store.ts           # zustand store + stream reducer
    supabase/{client,server,middleware}.ts
    types.ts                      # domain + stream protocol types
  middleware.ts                   # session refresh + route guards
e2e/chat.spec.ts                  # Playwright specs
scripts/generate-android-assets.py # icon + splash generator
android/                          # Capacitor Android project
```

### How a turn flows

1. `Composer` calls `sendMessage()` in the zustand store.
2. The store optimistically appends the user message and an empty assistant
   message, then `POST`s to `/api/chat`.
3. The route authenticates, resolves/creates the conversation, persists the user
   message, and creates the assistant row up-front (so tool calls can attach to it).
4. It streams from the LLM. If the model requests tools, each is executed, emitted
   as a `tool_call` / `tool_result` event, persisted to `tool_calls`, and fed back
   into the loop (max 5 iterations).
5. The store reduces each NDJSON event into the in-flight message; the final text
   is written back to Postgres.

### Turn modes

`POST /api/chat` accepts a `mode` field:

| Mode | Behaviour |
|---|---|
| `send` (default) | Appends a new user message and answers it |
| `regenerate` | Re-runs the last user turn and **adds** another answer, kept as a variant |
| `edit` | Rewrites the target user message, drops everything after it, and re-runs |

Regenerating deliberately keeps the previous answer: consecutive assistant
messages form a *variant group* (see `src/lib/variants.ts`), the bubble shows a
`< 2/3 >` control, and only the selected answer is rendered. The history builder
in the route collapses each group to its newest member before calling the model,
so the model is never fed its own discarded drafts.

### Stream protocol

Newline-delimited JSON events (`src/lib/types.ts`):

```
{ "type": "conversation",  "conversationId": "...", "title": "..." }
{ "type": "message_start", "messageId": "..." }
{ "type": "delta",         "text": "Hello" }
{ "type": "tool_call",     "id": "...", "name": "web_search", "arguments": {...} }
{ "type": "tool_result",   "id": "...", "name": "web_search", "result": {...}, "status": "success", "durationMs": 412 }
{ "type": "message_end",   "messageId": "...", "content": "..." }
{ "type": "error",         "message": "..." }
{ "type": "done" }
```

---

## Data model

| Table | Purpose | RLS |
|---|---|---|
| `profiles` | Public mirror of `auth.users` + user preferences | own row only |
| `conversations` | One row per chat thread | `user_id = auth.uid()` |
| `messages` | User / assistant / tool messages | own row **and** parent conversation owned |
| `tool_calls` | One row per tool invocation | via parent message ownership |

`messages` and `tool_calls` policies check the parent row as well as the row
itself, so a forged `conversation_id` cannot be used to read another user's thread.

Storage: the `attachments` bucket is public-read, but writes are restricted to a
folder named after the caller's uid (`{user_id}/...`).

---

## Security notes

- **RLS is on for every table** -- the anon key alone can never read another user's data.
- **`SUPABASE_SERVICE_ROLE_KEY` is server-only.** It is never sent to the browser.
- **`run_code` is opt-in** (`ENABLE_CODE_EXECUTION=1`) and runs in the app's own
  process with a 5-second timeout. It is **not** a security boundary -- for
  untrusted multi-tenant use, move it to an isolated runner (e.g. a container or
  a sandboxed edge function).
- **Uploads** are capped at 10 MB and restricted to an allow-list of MIME types.

---

## Deployment

The app is a standard Next.js deployment -- Vercel, Fly.io, Docker, or any Node host.

1. Set every variable from `.env.example` in your host's environment settings.
2. Add your production URL to Supabase **Authentication > URL Configuration**
   (Site URL and redirect URLs, including `/auth/callback`).
3. Deploy. `npm run build` is the build command; `npm run start` serves it.

---

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request
targeting `main`, and on every push to `main`:

**`verify` job**

1. `npm ci` -- reproducible install from the committed lockfile, with npm caching
   (see the lockfile caveat below)
2. `npm run typecheck` -- `tsc --noEmit`, must be clean
3. `npm run lint` -- advisory (non-blocking)
4. `npm test` -- the vitest suite, must pass
5. `npm run build` -- the production build must succeed

**`e2e` job**

1. `npm ci` and `npx playwright install --with-deps chromium`
2. `npm run test:e2e` -- builds and boots the app via the `webServer` block in
   `playwright.config.ts`, then runs the specs
3. Uploads the Playwright report as an artifact on failure

Both jobs supply placeholder `NEXT_PUBLIC_*` and server secrets so the build can
run without real credentials; no step reaches Supabase or the LLM provider. The
full chat flow self-skips without `E2E_AUTH_*` credentials.

**Lockfile caveat.** `package-lock.json` is not currently in the repository. The
lockfile is ~429 KB and the commit path used to publish this project is text-only
with a smaller per-file ceiling, so it could not be carried across. A 429 KB
lockfile is also well under GitHub's own 100 MB file limit, so there is no
inherent obstacle to committing it.

Both workflows therefore install **adaptively**: they run `npm ci` when the
lockfile is present and fall back to `npm install` with a `::warning::` when it is
not. Caching is keyed the same way -- `cache` is set to `npm` only when a lockfile
is in the checkout, because `actions/setup-node` fails outright if it is told to
cache npm without one to hash. Commit the lockfile and both workflows switch to
`npm ci` plus lockfile-keyed caching on the next run, with no further edits:

```bash
npm ci                       # lockfile already installed locally
npm run typecheck && npm test && npm run build
git add package-lock.json && git commit -m "chore: commit the lockfile" && git push
```

Once the file is guaranteed present, the `if [ -f package-lock.json ]` guard in
each workflow can be dropped and the install step reduced to plain `npm ci`.

---

## Testing

Two layers, deliberately separated by what they can actually prove.

### Unit tests -- `vitest`

```bash
npm test
```

Covers pure logic only -- no DOM, no backend, no React runtime -- so the whole
suite runs in about 15 seconds:

| File | Covers |
|---|---|
| `src/lib/tools/calculator.test.ts` | Arithmetic, precedence, functions, rejection of bad input |
| `src/lib/utils.test.ts` | `cn`, title derivation, token estimation, byte/clock formatting, slugs |
| `src/lib/export.test.ts` | Markdown/JSON export builders, filenames, tool-call rendering |
| `src/lib/commands.test.ts` | Slash-command table integrity, parsing and ranking |
| `src/lib/variants.test.ts` | Variant grouping, clamping, visibility collapsing |
| `src/lib/mobile/app-url.test.ts` | Native detection, build-URL resolution |
| `src/lib/mobile/preferences.test.ts` | URL normalisation, storage round-trips and failure modes |

### End-to-end tests -- `playwright`

```bash
npx playwright install chromium   # first run only
npm run test:e2e
```

[`e2e/chat.spec.ts`](e2e/chat.spec.ts) boots the real production server and checks
routing, rendering and the auth guard. The full **send -> stream -> persist** flow
needs a live Supabase project, so it self-skips unless credentials are supplied:

```bash
E2E_AUTH_EMAIL=you@example.com E2E_AUTH_PASSWORD=... npm run test:e2e
```

A skipped spec is reported as *skipped*, never as a pass.

---

## Android app

The web app is packaged as a native Android app with [Capacitor](https://capacitorjs.com).

### Why a remote-URL wrapper, not a static export

Agent Mobile is server-rendered: its streaming chat route, Supabase SSR cookie
sessions and API handlers only exist when Node is serving them. A static export
would yield an app with no backend. The WebView therefore loads the deployed URL,
which is what `server.url` in [`capacitor.config.ts`](capacitor.config.ts) sets.

The trade-off is explicit: **the APK needs a reachable deployment**, and because
the shell is a WebView, app-store review applies the usual WebView guidelines.

### Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 20+ | to build the web bundle |
| JDK 17 | `apt install openjdk-17-jdk-headless` |
| Android SDK | Build-Tools 34.0.0, Platform 34 -- Android Studio, or `sdkmanager` |
| `ANDROID_HOME` | must point at the SDK |

### Build the APK

```bash
# 1. point the packaged app at your deployment
export APP_URL=https://your-app.example.com

# 2. build the web app with that URL baked into the client bundle
export NEXT_PUBLIC_BUILD_APP_URL=$APP_URL
npm ci && npm run build

# 3. copy the web assets + plugin config into the Android project
npx cap sync android

# 4. produce the signed release APK
cd android && ./gradlew assembleRelease
```

The APK lands at
`android/app/build/outputs/apk/release/app-release.apk`.

### Signing

The keystore and its passwords are **never committed**. `android/app/build.gradle`
reads four environment variables, and when they are absent the release variant is
built *unsigned* rather than failing -- so a fresh clone still builds.

| Variable | Purpose |
|---|---|
| `ANDROID_KEYSTORE_PATH` | absolute path to the `.keystore` file |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias (e.g. `agent-mobile`) |
| `ANDROID_KEY_PASSWORD` | key password |

Create a keystore and build a signed APK:

```bash
keytool -genkeypair -v \
  -keystore release.keystore -alias agent-mobile \
  -keyalg RSA -keysize 2048 -validity 10000

export ANDROID_KEYSTORE_PATH=$PWD/release.keystore
export ANDROID_KEYSTORE_PASSWORD=...
export ANDROID_KEY_ALIAS=agent-mobile
export ANDROID_KEY_PASSWORD=...

cd android && ./gradlew assembleRelease
```

Verify the signature before distributing:

```bash
$ANDROID_HOME/build-tools/34.0.0/apksigner verify --verbose --print-certs \
  android/app/build/outputs/apk/release/app-release.apk
```

> **Keep the keystore safe.** Losing it means you can no longer publish updates to
> an app already installed from that key. Back it up somewhere durable, and never
> commit it -- `.gitignore` excludes `*.keystore`, `*.jks` and `android-secrets/`.

### Icons and splash screen

Source artwork lives in `assets/` and the per-density PNGs are generated:

```bash
python3 scripts/generate-android-assets.py \
  --icon assets/icon.png --splash assets/splash.png
```

The script writes legacy icons, adaptive-icon foreground/background layers (with
the descriptor XML), and portrait + landscape splash images for every density.
It reads the artwork's own corner colour as the adaptive-icon background so the
mark rounds correctly under any launcher mask. Requires Pillow.

The native palette in `android/app/src/main/res/values/colors.xml` mirrors the
web design tokens (`#141419` surface, `#7c5cff` brand), so there is no colour
pop between the splash screen and the first rendered frame.

### First-run configuration

The app resolves its backend URL in this order:

1. A URL the user saved on the setup screen (persisted in `localStorage`).
2. The URL baked in at build time (`APP_URL` -> `NEXT_PUBLIC_BUILD_APP_URL`).
3. `NEXT_PUBLIC_APP_URL`, then `PRODUCTION_URL` in `src/lib/mobile/app-url.ts`.

If none is configured, `NativeShell` renders `AppUrlSetup` instead of a blank
WebView -- a packaged wrapper with no URL is otherwise indistinguishable from a
crash. To bake the address in permanently, set `APP_URL` before building.

On the web, `NativeShell` is a pass-through and changes nothing.

### Install on a device

```bash
# over USB, with developer options + USB debugging enabled
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Or transfer the `.apk` to the device and open it -- Android will ask you to allow
installation from that source.

### Reproducing the Android project

Most of the Android project is committed as text. A few **binaries are not** in
the repository, because they cannot be carried through the text-only commit path
used to publish this project:

| Uncommitted asset | How to reproduce it |
|---|---|
| `android/gradle/wrapper/gradle-wrapper.jar` | re-download from the [Gradle 8.2.1 distribution](https://raw.githubusercontent.com/gradle/gradle/v8.2.1/gradle/wrapper/gradle-wrapper.jar), or run `npx cap add android` in a scratch directory |
| `android/app/src/main/res/**/*.png` | `python3 scripts/generate-android-assets.py --icon assets/icon.png --splash assets/splash.png` (needs Pillow) |
| `assets/icon.png`, `assets/splash.png` | source artwork -- regenerate or supply your own square PNGs |
| `android/local.properties` | machine-local; write `sdk.dir=/path/to/android-sdk` (never committed) |

The [`android-release.yml`](.github/workflows/android-release.yml) workflow
fetches the wrapper JAR and regenerates the res/ bitmaps from `assets/`, then
fails with an explicit message naming anything it still cannot obtain -- so a
missing binary produces a clear error, not a cryptic Gradle stack trace.

The workflow also assembles the APK with a bounded heap (`--max-workers=2`,
`-Xmx768m`). That matters on small runners: a release build over a 64-CPU host
derives its parallelism from `nproc`, and an unbounded worker count is enough to
exceed a 2 GB container cap and take the Gradle daemon down mid-build.

A clean local rebuild, when every asset is present:

```bash
cd android && ./gradlew assembleRelease
```

Confirmed working: that invocation produced `app-release.apk`, **8,974,195 bytes
(~8.6 MB)**, `BUILD SUCCESSFUL`, signed and verified with

```
apksigner verify --verbose --print-certs app-release.apk
  Verified using v1 scheme (JAR signing): true
  Verified using v2 scheme (APK Signature Scheme v2): true
  Signer #1 certificate DN: CN=Agent Mobile
```

The manifest reports `package=com.daviekumi.agentmobile`, `label='Agent Mobile'`,
`minSdk 22 / targetSdk 34`.

### Automated builds

[`.github/workflows/android-release.yml`](.github/workflows/android-release.yml)
builds the signed APK:

- **On a `v*` tag** -- builds, verifies the signature, and attaches the APK to a
  GitHub Release.
- **Manual dispatch** -- builds and uploads the APK as a workflow artifact, with an
  optional `app_url` input.

Add these repository secrets before the first run:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

---

## License

MIT
