# AGENTS.md

This file provides instructions for AI coding agents (OpenAI Codex, Claude Code, Cursor, Amp, Jules, etc.) working in this repository.

## Project Identity

**Borsatti's** is a luxury fashion AI research assistant, forked from the open-source [Morphic](https://github.com/miurla/morphic) project. It is rebranded and extended for a luxury fashion / editorial audience — think *Business of Fashion*, *Vogue Business*, and haute couture research.

- Live URL: **https://borsattis.com** (deployed on Vercel)
- Runtime: Next.js 16 (App Router) + Bun + Vercel AI SDK 5

---

## Key Commands

| Command | Purpose |
|---|---|
| `bun dev` | Start dev server with Turbopack at `http://localhost:3000` |
| `bun run build` | Production build |
| `bun start` | Start production server |
| `bun lint` | ESLint (includes import sorting — run `bun lint --fix` to auto-sort) |
| `bun typecheck` | TypeScript type checking |
| `bun format` | Prettier formatting |
| `bun format:check` | Check formatting without modifying |
| `bun migrate` | Run database migrations |
| `bun run test` | Run tests with **Vitest** (do NOT use `bun test`) |
| `bun run test:watch` | Tests in watch mode |

### Pre-PR Checklist (all must pass before opening a PR)

```bash
bun lint
bun typecheck
bun format:check
bun run build
bun run test
```

Run `bun lint --fix` and `bun format` to auto-fix lint/formatting issues.

---

## Repository Layout

```
/app                      # Next.js App Router pages & API routes
  /api/                   # Backend: chat, search, auth endpoints
  /auth/                  # Auth pages (login, signup, reset)
  /chats/                 # Chats list page (custom Borsatti's feature)
  /discover/              # Discover news feed (custom Borsatti's feature)
  /projects/              # Projects feature (custom Borsatti's feature)
  /projects/[id]/         # Individual project view
  /search/[id]/           # Individual search/chat page
  /share/                 # Shareable result pages

/components               # React components
  app-sidebar.tsx         # Left sidebar — no B logo, "Borsatti's" at text-xl
  /artifact/              # Search result & AI response display
  /sidebar/               # Chat history section
  /ui/                    # shadcn/ui primitives

/lib                      # Core logic
  /agents/                # AI agents (research, question generation)
  /auth/                  # Auth helpers — get-current-user.ts
  /config/                # Model config management
  /db/                    # PostgreSQL + Drizzle ORM
    schema.ts             # Database schema (includes Projects table)
    migrations/           # Drizzle migrations
  /actions/               # Server actions (chat-db.ts)
  /streaming/             # Vercel AI SDK stream handling
  /tools/                 # Search & retrieval tools
  /types/                 # TypeScript type definitions
  /schema/                # Zod validation schemas

/public/config/           # models.json — AI model definitions
/drizzle/                 # Drizzle migration files
```

---

## Tech Stack

- **Next.js 16.0.0** — App Router, React Server Components, Turbopack
- **React 19.2.0** + TypeScript (strict mode)
- **Vercel AI SDK 5.0.0-alpha.2** — AI streaming + GenerativeUI
- **Supabase** — Auth + backend services
- **PostgreSQL 17** + Drizzle ORM — database + chat history
- **Redis** (Upstash or local) — SearXNG advanced search caching
- **Tailwind CSS** + shadcn/ui
- **Bun** — package manager and runtime
- **Vitest** — test runner

---

## Borsatti's Customisations (vs. upstream Morphic)

These are intentional customisations on top of upstream Morphic. Do **not** revert them.

### Branding & UI

- Brand name is **"Borsatti's"** everywhere (upstream was "Morphic")
- **Bentham** display font (`font-display`) for headings and brand name
- **Sidebar** (`components/app-sidebar.tsx`): no B lettermark icon; brand text at `text-xl`
- **Homepage** (`app/page.tsx`): personalised luxury fashion welcome and prompt categories
- **Action buttons**: luxury fashion prompt categories (not generic topics)
- **Navbar**: feedback button removed

### Pages Added

| Page | Route | Description |
|---|---|---|
| Chats | `/chats` | Full chats list with search, multi-select, and delete |
| Projects | `/projects` | Project grouping with DB, API, and UI |
| Project Detail | `/projects/[id]` | Individual project view |
| Discover | `/discover` | News feed with luxury fashion category tabs (BoF, Vogue Business, etc.) |

### Sidebar Navigation

Four nav items: **New**, **Chats**, **Projects**, **Discover** — each with a Lucide icon.

### Database

Custom `projects` table added to the Morphic base schema. Run `bun migrate` after pulling to apply. Schema: `lib/db/schema.ts`. Migrations: `/drizzle/`.

### Deployment

- Vercel config: `vercel.json`
- `bun migrate` runs automatically as part of the Vercel build step

---

## Database

### Connection

The app uses **PostgreSQL 17** via Drizzle ORM (`drizzle-orm/postgres-js`).

```bash
# Primary (owner user — RLS bypassed, use for migrations only)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Restricted (app_user — RLS enforced, preferred for runtime)
DATABASE_RESTRICTED_URL=postgresql://app_user:password@host/database?sslmode=require
```

- At runtime, `DATABASE_RESTRICTED_URL` is preferred over `DATABASE_URL` (if set)
- SSL is enabled by default for cloud DBs; set `DATABASE_SSL_DISABLED=true` for local/Docker PostgreSQL
- Connection pool: max 20 connections (`lib/db/index.ts`)
- All DB operations go through `lib/db/index.ts` which exports `db` (Drizzle instance)

### Row-Level Security (RLS)

All tables have PostgreSQL RLS enabled. Every runtime query must be wrapped in `withRLS(userId, callback)` from `lib/db/with-rls.ts`, which sets `app.current_user_id` for the transaction scope:

```typescript
import { withRLS } from '@/lib/db/with-rls'

const result = await withRLS(userId, async (tx) => {
  return tx.select().from(chats)
})
```

Use `withOptionalRLS(userId | null, callback)` for operations that may be public (e.g. reading shared chats).

### Schema (`lib/db/schema.ts`)

IDs are generated with `createId()` from `@paralleldrive/cuid2`.

#### `projects`
| Column | Type | Notes |
|---|---|---|
| `id` | varchar(191) PK | cuid2 |
| `user_id` | varchar(255) NOT NULL | owner |
| `name` | text NOT NULL | project display name |
| `description` | text | optional |
| `instructions` | text | system prompt / instructions for the project |
| `created_at` | timestamp NOT NULL | default now |
| `updated_at` | timestamp | nullable |

Indexes: `projects_user_id_idx`, `projects_user_id_created_at_idx`
RLS: users can only access their own projects (`user_id = app.current_user_id`)

#### `chats`
| Column | Type | Notes |
|---|---|---|
| `id` | varchar(191) PK | cuid2 |
| `created_at` | timestamp NOT NULL | default now |
| `title` | text NOT NULL | |
| `user_id` | varchar(255) NOT NULL | owner |
| `visibility` | varchar enum `public\|private` | default `private` |
| `project_id` | varchar(191) FK → projects.id | nullable, SET NULL on delete |

Indexes: `chats_user_id_idx`, `chats_user_id_created_at_idx`, `chats_created_at_idx`, `chats_id_user_id_idx`
RLS: users manage own chats; `public` chats are readable by all

#### `messages`
| Column | Type | Notes |
|---|---|---|
| `id` | varchar(191) PK | cuid2 |
| `chat_id` | varchar(191) FK → chats.id | CASCADE DELETE |
| `role` | varchar | `user`, `assistant`, `system`, `tool` |
| `created_at` | timestamp NOT NULL | |
| `updated_at` | timestamp | |
| `metadata` | jsonb | arbitrary key-value metadata |

Indexes: `messages_chat_id_idx`, `messages_chat_id_created_at_idx`
RLS: accessible if user owns the parent chat

#### `parts`
Message parts (the actual content chunks of a message). One message has many ordered parts.

| Column | Type | Notes |
|---|---|---|
| `id` | varchar(191) PK | |
| `message_id` | varchar(191) FK → messages.id | CASCADE DELETE |
| `order` | integer NOT NULL | sort order within message |
| `type` | varchar NOT NULL | see part types below |
| `created_at` | timestamp NOT NULL | |

**Part types and their columns:**

| Type | Columns |
|---|---|
| `text` | `text_text` |
| `reasoning` | `reasoning_text` |
| `file` | `file_media_type`, `file_filename`, `file_url` |
| `source-url` | `source_url_sourceId`, `source_url_url`, `source_url_title` |
| `source-document` | `source_document_*` (sourceId, mediaType, title, filename, url, snippet) |
| `tool-*` | `tool_toolCallId`, `tool_state`, `tool_errorText`, plus tool-specific input/output JSON |
| `data` | `data_prefix`, `data_content`, `data_id` |

Tool-specific columns: `tool_search_input/output`, `tool_fetch_input/output`, `tool_question_input/output`, `tool_todoWrite_input/output`, `tool_todoRead_input/output`, `tool_dynamic_*`

Valid `tool_state` values: `input-streaming`, `input-available`, `output-available`, `output-error`

Indexes: `parts_message_id_idx`, `parts_message_id_order_idx`
RLS: accessible if user owns the parent chat (via messages join)

#### `feedback`
| Column | Type | Notes |
|---|---|---|
| `id` | varchar(191) PK | |
| `user_id` | varchar(255) | nullable |
| `sentiment` | varchar enum `positive\|neutral\|negative` NOT NULL | |
| `message` | text NOT NULL | |
| `page_url` | text NOT NULL | |
| `user_agent` | text | |
| `created_at` | timestamp NOT NULL | |

RLS: anyone can insert; anyone can select

### Relations (`lib/db/relations.ts`)

```
projects  ──< chats  ──< messages  ──< parts
```

- `projects` → many `chats`
- `chats` → one `project` (optional), many `messages`
- `messages` → one `chat`, many `parts`
- `parts` → one `message`

### Database Actions

| File | Purpose |
|---|---|
| `lib/db/actions.ts` | Low-level DB read/write operations |
| `lib/actions/chat.ts` | Chat CRUD server actions |
| `lib/actions/project.ts` | Project CRUD server actions |
| `lib/actions/feedback.ts` | Feedback submission |
| `lib/actions/site-feedback.ts` | Site-level feedback |

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Main chat/search endpoint (streaming) |
| `/api/chats` | GET/DELETE | List and delete chats |
| `/api/projects` | GET/POST | List and create projects |
| `/api/projects/[id]` | GET/PUT/DELETE | Project detail operations |
| `/api/discover` | GET | Discover feed articles |
| `/api/advanced-search` | POST | Advanced search with SearXNG |
| `/api/feedback` | POST | Submit feedback |
| `/api/upload` | POST | File upload (Cloudflare R2) |

### Migrations

- Migration files: `/drizzle/*.sql`
- Generate: `bunx drizzle-kit generate`
- Apply: `bun migrate` (runs `lib/db/migrate.ts`)
- Schema source of truth: `lib/db/schema.ts`
- Latest migration: `0011_concerned_ben_parker.sql`
- **Always run `bun migrate` after pulling schema changes**

---

## File Upload Integration (Cloudflare R2)

Optional. Required env vars:

```bash
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=user-uploads  # default
R2_PUBLIC_URL=               # e.g. https://pub-xxx.r2.dev
```

---

## AI & Search Configuration

### Required Environment Variables

```bash
OPENAI_API_KEY=       # Default AI provider
TAVILY_API_KEY=       # Default search provider
DATABASE_URL=         # PostgreSQL connection string
```

### Search Providers

| Provider | Env Var | Notes |
|---|---|---|
| Tavily (default) | `TAVILY_API_KEY` | Default |
| Exa | `EXA_API_KEY` | Neural search alternative |
| SearXNG | `SEARXNG_API_URL` | Self-hosted |
| Brave | `BRAVE_SEARCH_API_KEY` | Optional; best for video/image |
| Firecrawl | `FIRECRAWL_API_KEY` | Web scraping alternative |

### AI Providers

| Provider | Env Var |
|---|---|
| OpenAI (default) | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Google Gemini | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Ollama (local) | `OLLAMA_BASE_URL` |

Model definitions live in `public/config/models.json` with fields: `id`, `provider`, `providerId`, `enabled`, `toolCallType`, `toolCallModel`.

### Optional Features

- Chat history persistence: `ENABLE_SAVE_CHAT_HISTORY=true` + Redis
- Sharing: `NEXT_PUBLIC_ENABLE_SHARE=true`
- Langfuse tracing: `ENABLE_LANGFUSE_TRACING=true`

---

## Authentication

Default: **anonymous mode** (`ENABLE_AUTH=false`) — single shared user ID for personal use only. Auth logic: `lib/auth/get-current-user.ts:22-40`.

To enable Supabase auth:

```bash
ENABLE_AUTH=true
NEXT_PUBLIC_SUPABASE_URL=[your-supabase-url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-supabase-anon-key]
```

Anonymous mode is **not** suitable for multi-user or production deployments.

---

## Testing

- Framework: **Vitest** — do NOT use `bun test` (that invokes Bun's built-in runner, which lacks Vitest features)
- Run: `bun run test`
- Test files: co-located with source, `.test.ts` / `.test.tsx` extension
- CI runs `bun run test` on every PR

---

## MCP (Model Context Protocol)

Next.js 16 exposes a built-in MCP server at `http://localhost:3000/_next/mcp` when the dev server is running. No extra configuration needed.

Available tools:
- `get_errors` — current build/runtime errors
- `get_project_metadata` — project path and dev URL
- `get_page_metadata` — runtime page render info
- `get_logs` — dev log file path
- `get_server_action_by_id` — locate server actions by ID

The `.mcp.json` in the project root also enables the Next DevTools MCP package for AI assistants that support project-scoped MCP servers.

---

## Code Style & Conventions

- **Imports**: sorted by `eslint-plugin-simple-import-sort`; run `bun lint --fix` to auto-sort
- **Formatting**: Prettier; run `bun format` to fix
- **Types**: strict TypeScript; avoid `any`
- **Validation**: Zod for all external/user data (`/lib/schema/`)
- **Components**: prefer React Server Components; use `"use client"` only when necessary
- **No dead code**: remove unused imports, variables, and files when you encounter them
- **No over-engineering**: minimal complexity for the task at hand; no premature abstraction

## PR Messages

When creating a PR, include:
1. Short title (≤70 chars) describing the change
2. Summary of what changed and why
3. Test plan — what was tested and how to verify
