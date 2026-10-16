# Agent Mobile

A ChatGPT-style AI chat app with skills & tools. Next.js 15 (App Router) + TypeScript + Tailwind + Supabase (auth, Postgres, RLS, storage) with streaming responses and tool calling.

## What it does

- **Streaming chat** with a tool-calling loop (up to 5 iterations per turn)
- **Conversation history** with search, pin, rename, delete, archive and time buckets
- **Message actions** -- regenerate, edit & resend, copy, delete, with relative and full timestamps
- **Variants** -- regenerating keeps the previous response so you can switch between them
- **In-thread search** (`⌘F` / `Ctrl+F`) with match stepping and highlighting
- **Slash commands** in the composer for tools, skills and templates
- **Export** a conversation as Markdown or JSON, or copy the transcript
- **Models & settings** -- per-user default model and custom system prompt, persisted in `profiles`
- **Attachments** -- drag-and-drop or paste images, stored in Supabase Storage

### Built-in tools

| Tool | What it does |
|---|---|
| `web_search` | Search the web (Tavily) |
| `get_current_time` | Current time in any IANA timezone |
| `get_weather` | Current conditions (OpenWeatherMap) |
| `calculator` | Expression evaluator -- `+ - * / % ^`, parentheses, `sqrt/log/min/max`, `pi/e/tau` |
| `read_file` | Read a file attached to the conversation |
| `generate_image` | Text-to-image (`gpt-image-1`) |
| `run_code` | Sandboxed JavaScript, opt-in via `ENABLE_CODE_EXECUTION=1` |

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/daviekumi-glitch/agent-mobile.git
cd agent-mobile
npm install
```

### 2. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then apply the migrations
in `supabase/migrations/` in order (either via the SQL editor or `supabase db push`).

Every table has row-level security enabled and scoped to the owning user.

### 3. Configure environment

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server-only key, never exposed to the client |
| `OPENAI_API_KEY` | yes | chat completions and image generation |
| `TAVILY_API_KEY` | no | enables `web_search` |
| `OPENWEATHER_API_KEY` | no | enables `get_weather` |
| `ENABLE_CODE_EXECUTION` | no | `1` enables `run_code` |
| `NEXT_PUBLIC_APP_URL` | no | absolute URL of this deployment |

Tools whose key is missing show a disabled badge in the skills panel rather than
failing at call time.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

## Architecture

```
src/
  app/
    (auth)/             sign-in, sign-up
    api/chat/           streaming chat endpoint (NDJSON)
    api/messages/[id]/  delete a message
    api/conversations/  conversation CRUD
  components/
    chat/               thread, bubble, composer, tool cards, editors
    sidebar/            conversation list, search, menus
    native/             Capacitor shell + first-run setup screen
    ui/                 shadcn/ui primitives
  lib/
    supabase/           browser, server and service clients
    tools/              one module per tool + the registry
    mobile/             app-url resolution for the native shell
    export.ts           Markdown / JSON transcript serialisation
  store/
    chat-store.ts       zustand: messages, variants, streaming, tools
```

### How a turn flows

1. The client posts to `/api/chat` with `mode: send | regenerate | edit`.
2. The route loads the most recent 60 messages, newest-first, and reverses them.
3. It streams tokens back as NDJSON, running the tool loop when the model calls
   a tool -- up to 5 iterations.
4. `send` appends, `regenerate` replaces the previous reply, `edit` truncates
   everything after the edited message. No mode duplicates the user's turn.

### Stream protocol

The response is `application/x-ndjson`, one JSON object per line:

```jsonc
{"type":"token","value":"Hello"}
{"type":"tool_call","id":"...","name":"web_search","input":{...}}
{"type":"tool_result","id":"...","output":"..."}
{"type":"done","messageId":"..."}
{"type":"error","message":"..."}
```

## Data model

`profiles`, `conversations`, `messages`, `tool_calls` -- RLS enabled on every
table, each policy scoped to `auth.uid()`. Migrations are additive only.

## Security notes

- The service-role key is only ever read server-side.
- `run_code` executes in the app's own process behind an opt-in flag and a
  5-second timeout. It is **not** a security boundary for untrusted users.
- Never commit `.env.local`; `.gitignore` excludes `.env*` except `.env.example`.

## Deployment

The app is server-rendered and needs a Node host for `/api/chat` streaming and
Supabase SSR cookie sessions. A static export will not work.

Deploy to Vercel, then set the same environment variables in the project settings.
Set `NEXT_PUBLIC_APP_URL` to the deployed origin.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request
to `main` and every push to `main`:

```
install -> typecheck -> lint -> test -> build
```

Both workflows install adaptively:

```bash
if [ -f package-lock.json ]; then npm ci; else npm install; fi
```

`package-lock.json` is not currently tracked, so a clean checkout falls back to
`npm install` and emits a `::warning::`. Committing the lockfile is a
one-command fix and will switch both workflows to `npm ci` with npm caching
automatically, because the cache key and install command are both derived from
the lockfile being present. Without that guard, `actions/setup-node` with
`cache: npm` fails outright on a checkout that has no lockfile to hash.

The lint step is advisory (`continue-on-error: true`) so that a stylistic
finding cannot block a merge.

## Testing

### Unit tests -- `vitest`

```bash
npm test
```

Covers the pure logic: the calculator parser, export serialisation, app-URL
resolution and store helpers. 127 tests across 7 files.

### End-to-end tests -- `playwright`

```bash
npx playwright install chromium
npm run test:e2e
```

Drives the real chat flow: send a message, watch the stream, confirm the turn
persists.

## Android app

The app ships as a Capacitor wrapper. The Android project lives in `android/`.

### Why a remote-URL wrapper, not a static export

The packaged app loads the deployed Next.js deployment rather than bundling a
static export. The app is server-rendered: `/api/chat` streaming, Supabase SSR
cookie sessions and the API routes only exist when a Node process serves them. A
static export would produce an app with no backend.

The URL is resolved at runtime, in this order:

1. `CAPACITOR_APP_URL` (set at `cap sync` time)
2. The URL baked in at build time (`APP_URL` -> `NEXT_PUBLIC_BUILD_APP_URL`)
3. `NEXT_PUBLIC_APP_URL`, then `PRODUCTION_URL` in `src/lib/mobile/app-url.ts`

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

#### Prebuilt downloads

Signed APKs are published on the
[releases page](https://github.com/daviekumi-glitch/agent-mobile/releases).
The current release is [`v0.1.0`](https://github.com/daviekumi-glitch/agent-mobile/releases/tag/v0.1.0):

| Artifact | Size | Package |
|---|---|---|
| `agent-mobile-v0.1.0-release.apk` | 8,974,195 bytes (~8.6 MB) | `com.daviekumi.agentmobile` |

Download it directly:

```bash
curl -LO https://github.com/daviekumi-glitch/agent-mobile/releases/download/v0.1.0/agent-mobile-v0.1.0-release.apk
```

A `releases/` folder in the repository would also work, but Git keeps every
version of a binary forever, so Releases is the better home for build output.
Verify what you downloaded before installing:

```bash
md5sum agent-mobile-v0.1.0-release.apk
# f3359c691b9e657a728af0bdfa930537
```

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

### Attaching a prebuilt APK to a release

[`.github/workflows/attach-release-asset.yml`](.github/workflows/attach-release-asset.yml)
exists for a specific reason. `android-release.yml` builds and signs the APK, but
the automation environment that maintains this repository **cannot push binary
release assets through the GitHub API** -- it can only create text blobs, and
attaching a release asset requires a binary multipart transfer. Releases
published from automation would therefore be missing their APK.

This workflow moves that one step onto a real runner. It downloads a prebuilt
APK from a public URL, verifies it, and attaches it to the named release with the
runner's own `gh` CLI. It is triggered by **workflow dispatch**, with inputs for
the release tag, the APK URL, the asset filename, and an optional expected md5.
The defaults point at the `v0.1.0` build, so that release can be completed in one
click from the Actions tab.

Two guards are worth knowing about, because both were learned the hard way:

1. **A hosted link may return HTML, not the file.** Google Drive answers a plain
   `drive.google.com/uc?id=...&export=download` request with HTTP 200 and a small
   "Virus scan warning" page for binaries it decides to scan. Because the status
   is `200`, `curl -f` succeeds and the problem only surfaces later as a
   checksum mismatch. The download step therefore inspects `Content-Type` and
   fails immediately on `text/html`. Use the
   `drive.usercontent.google.com/download?id=...&export=download&confirm=t`
   form, which serves the bytes.
2. **The asset is verified before upload.** md5 is compared against the expected
   value, and the archive is opened to confirm it contains `AndroidManifest.xml`,
   `classes.dex` and `resources.arsc`. A consent page can never be published as
   "the APK".

---

## License

MIT
