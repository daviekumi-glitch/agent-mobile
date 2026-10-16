# Agent Mobile

A ChatGPT-style AI chat application with **skills and tools** built into the conversation.
Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase · streaming responses.

---

## What it does

| Capability | Detail |
|---|---|
| **Streaming chat** | Token-by-token NDJSON stream from `/api/chat`, rendered live |
| **Markdown + code** | GitHub-flavoured Markdown, syntax highlighting, per-block copy buttons |
| **Message actions** | Regenerate, edit & resend, copy, delete, per-message timestamps |
| **In-thread search** | ⌘F / Ctrl+F search with match navigation and highlighting |
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
| `calculator` | Math & Data | — |
| `run_code` | Code Execution | `ENABLE_CODE_EXECUTION=1` |
| `generate_image` | Image Generation | `OPENAI_API_KEY` |
| `read_file` | File Reading | — |
| `get_current_time` | Utilities | — |

Tools whose env var is missing are shown as **disabled** in the panel rather than
silently failing — the model is told the tool is unavailable and answers without it.

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
2. Open **SQL Editor** and run the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   This creates the tables, indexes, triggers, RLS policies and the
   `attachments` storage bucket.

   *Or, with the Supabase CLI:*

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

3. In **Authentication → Providers**, make sure **Email** is enabled.
   For local development, turn **Confirm email** off so signup logs you straight in.

### 3. Configure environment

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key (RLS still applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only privileged key — never expose |
| `OPENAI_API_KEY` | ✅ | LLM provider key |
| `OPENAI_BASE_URL` | — | Point at any OpenAI-compatible gateway |
| `TAVILY_API_KEY` | — | Enables the `web_search` tool |
| `OPENWEATHER_API_KEY` | — | Enables the `get_weather` tool |
| `ENABLE_CODE_EXECUTION` | — | `1` enables the `run_code` tool |
| `NEXT_PUBLIC_SITE_URL` | — | Canonical URL, used for auth redirects |

### 4. Run

```bash
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # streaming chat + tool-calling loop
│   │   ├── conversations/route.ts     # list / create
│   │   ├── conversations/[id]/route.ts# get / patch / delete
│   │   ├── messages/[id]/route.ts     # delete a single message
│   │   ├── tools/route.ts             # model + skill + tool metadata
│   │   └── upload/route.ts            # attachment upload → Storage
│   ├── auth/callback/route.ts         # OAuth / email code exchange
│   ├── chat/page.tsx                  # protected chat route
│   ├── login/ · register/             # auth pages
│   ├── layout.tsx · page.tsx          # shell + landing
│   └── globals.css                    # design tokens + prose + hljs theme
├── components/
│   ├── chat/
│   │   ├── chat-shell.tsx             # layout composition
│   │   ├── sidebar.tsx                # history, search, pin, rename, delete
│   │   ├── message-thread.tsx         # auto-scroll + in-thread search
│   │   ├── message-bubble.tsx         # user/assistant bubbles + actions
│   │   ├── markdown.tsx               # markdown + copyable code blocks
│   │   ├── tool-call-card.tsx         # expandable tool-call card
│   │   ├── composer.tsx               # input, attachments, send/stop
│   │   ├── model-picker.tsx           # model switcher
│   │   ├── tools-panel.tsx            # skills & tools configuration
│   │   └── empty-state.tsx            # designed empty state + suggestions
│   ├── auth/auth-form.tsx
│   └── ui/                            # shadcn-style primitives
├── lib/
│   ├── ai/client.ts                   # OpenAI client + model registry
│   ├── tools/registry.ts              # tool/skill definitions + JSON schemas
│   ├── tools/executor.ts              # server-side tool implementations
│   ├── tools/calculator.ts            # safe arithmetic evaluator (no eval)
│   ├── tools/weather.ts               # weather response mapper
│   ├── export.ts                      # Markdown / JSON conversation export
│   ├── store/chat-store.ts            # zustand store + stream reducer
│   ├── supabase/{client,server,middleware}.ts
│   └── types.ts                       # domain + stream protocol types
└── middleware.ts                      # session refresh + route guards
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
| `regenerate` | Re-runs the last user turn; the previous assistant reply is replaced, not appended |
| `edit` | Rewrites the target user message, drops everything after it, and re-runs |

Because the previous reply is deleted server-side *and* the client optimistically
truncates the thread, regenerating never duplicates the user's message.

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
| `profiles` | Public mirror of `auth.users`, auto-created by trigger | own row only |
| `conversations` | One row per chat thread | `user_id = auth.uid()` |
| `messages` | User / assistant / tool messages | own row **and** parent conversation owned |
| `tool_calls` | One row per tool invocation | via parent message ownership |

`messages` and `tool_calls` policies check the parent row as well as the row
itself, so a forged `conversation_id` cannot be used to read another user's thread.

Storage: the `attachments` bucket is public-read, but writes are restricted to a
folder named after the caller's uid (`{user_id}/...`).

---

## Security notes

- **RLS is on for every table** — the anon key alone can never read another user's data.
- **`SUPABASE_SERVICE_ROLE_KEY` is server-only.** It is never sent to the browser.
- **`run_code` is opt-in** (`ENABLE_CODE_EXECUTION=1`) and runs in the app's own
  process with a 5-second timeout. It is **not** a security boundary — for
  untrusted multi-tenant use, move it to an isolated runner (e.g. a container or
  a sandboxed edge function).
- **Uploads** are capped at 10 MB and restricted to an allow-list of MIME types.

---

## Deployment

The app is a standard Next.js deployment — Vercel, Fly.io, Docker, or any Node host.

1. Set every variable from `.env.example` in your host's environment settings.
2. Add your production URL to Supabase **Authentication → URL Configuration**
   (Site URL and redirect URLs, including `/auth/callback`).
3. Deploy. `npm run build` is the build command; `npm run start` serves it.

---

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request
targeting `main`, and on every push to `main`:

1. `npm install` — install dependencies
2. `npm run typecheck` — `tsc --noEmit`, must be clean
3. `npm run lint` — advisory (non-blocking)
4. `npm run build` — the production build must succeed

The workflow supplies placeholder `NEXT_PUBLIC_*` and server secrets so the build
can run without real credentials; no step reaches Supabase or the LLM provider.

> **Note on the lockfile:** this repository does not currently track
> `package-lock.json`. The install step therefore uses `npm install` so CI works
> on a cold checkout. Recommended follow-up: commit the lockfile, then switch the
> step to `npm ci` and add `cache: npm` to `actions/setup-node` for reproducible,
> faster installs.

---

## License

MIT
