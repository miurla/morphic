# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

> **For the universal agent reference** (OpenAI Codex, Cursor, Amp, etc.) see `AGENTS.md`.

---

## Project Identity

**Borsatti's** is a luxury fashion AI research assistant, forked from the open-source [Morphic](https://github.com/miurla/morphic) project and deployed at **https://borsattis.com**. It is rebranded for a luxury fashion / editorial audience (Business of Fashion, Vogue Business, haute couture research).

---

## Key Commands

### Development

- `bun dev` - Start development server with Turbopack (http://localhost:3000)
- `bun run build` - Create production build
- `bun start` - Start production server
- `bun lint` - Run ESLint for code quality checks and import sorting
- `bun typecheck` - Run TypeScript type checking
- `bun format` - Format code with Prettier
- `bun format:check` - Check code formatting without modifying files
- `bun migrate` - Run database migrations
- `bun run test` - Run tests with Vitest (use this, NOT `bun test`)
- `bun run test:watch` - Run tests in watch mode

### Docker

- `docker compose up -d` - Run the application with Docker (includes PostgreSQL 17, Redis, Morphic app, and SearXNG)
- `docker compose down` - Stop all containers
- `docker compose down -v` - Stop all containers and remove volumes (deletes database data)
- `docker pull ghcr.io/miurla/morphic:latest` - Pull prebuilt Docker image

#### Docker Authentication

**Default Behavior**: Docker deployments run in **anonymous mode** (`ENABLE_AUTH=false`). All users share a single anonymous user ID.

**⚠️ Security Warning:** Anonymous mode is only for personal, single-user local environments. Not suitable for multi-user or production deployments. Morphic Cloud deployments block `ENABLE_AUTH=false` automatically.

**Enabling Authentication:**

```bash
ENABLE_AUTH=true  # or remove ENABLE_AUTH from docker-compose.yaml
NEXT_PUBLIC_SUPABASE_URL=[your-supabase-url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-supabase-anon-key]
```

Auth logic: `lib/auth/get-current-user.ts:22-40`

---

## Borsatti's Customisations (vs. upstream Morphic)

Do **not** revert these intentional changes.

### Branding & UI

- Brand name is **"Borsatti's"** throughout (upstream was "Morphic")
- **Bentham** display font (`font-display`) for headings and brand name
- **Sidebar** (`components/app-sidebar.tsx:24-26`): no B lettermark icon; brand text at `text-xl`
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

### Deployment

- Vercel config: `vercel.json`
- `bun migrate` runs automatically as part of the Vercel build step

---

## Architecture Overview

### Tech Stack

- **Next.js 16.0.0** with App Router, React Server Components, and Turbopack
- **React 19.2.0** with TypeScript (strict mode)
- **Vercel AI SDK 5.0.0-alpha.2** for AI streaming and GenerativeUI
- **Supabase** for authentication and backend services
- **PostgreSQL 17** with Drizzle ORM for database and chat history storage
- **Redis** (Upstash or local) for SearXNG advanced search caching
- **Tailwind CSS** with shadcn/ui components
- **Bun** — package manager and runtime

### App Router Structure (`/app`)

- `/api/` — Backend API routes (chat, search, chats, projects, discover, feedback, upload)
- `/auth/` — Auth pages (login, signup, password reset)
- `/chats/` — Chats list page
- `/discover/` — Discover news feed
- `/projects/` — Projects list and detail pages
- `/search/[id]/` — Individual search/chat page
- `/share/` — Shareable result pages

### AI Integration (`/lib`)

- `/lib/agents/` — AI agents for research and question generation
- `/lib/config/` — Model configuration management
- `/lib/streaming/` — Stream handling for AI responses
- `/lib/tools/` — Search and retrieval tool implementations
- Models configured in `public/config/models.json`

### State Management

- Server-side state via React Server Components
- Client-side hooks in `/hooks/`
- PostgreSQL for persistent chat history and projects
- Supabase for user data

---

## Database

### Connection (`lib/db/index.ts`)

Uses `DATABASE_RESTRICTED_URL` if set (preferred — RLS enforced via `app_user`), else falls back to `DATABASE_URL` (owner user — RLS bypassed, suitable for migrations only).

```bash
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
DATABASE_RESTRICTED_URL=postgresql://app_user:password@host/database?sslmode=require  # optional but recommended
DATABASE_SSL_DISABLED=true  # set for local/Docker only — never for cloud DBs
```

Connection pool: max 20 connections.

### Row-Level Security (RLS)

All tables use PostgreSQL RLS. Use `withRLS(userId, callback)` from `lib/db/with-rls.ts` for all runtime queries — it sets `app.current_user_id` for the transaction:

```typescript
import { withRLS } from '@/lib/db/with-rls'
const result = await withRLS(userId, async (tx) => tx.select().from(chats))
```

Use `withOptionalRLS(userId | null, callback)` when the operation may be public.

### Schema (`lib/db/schema.ts`)

IDs use `createId()` from `@paralleldrive/cuid2` (cuid2 format, max 191 chars).

#### `projects`
| Column | Type | Notes |
|---|---|---|
| `id` | varchar(191) PK | cuid2 |
| `user_id` | varchar(255) NOT NULL | owner |
| `name` | text NOT NULL | |
| `description` | text | optional |
| `instructions` | text | system prompt / project instructions |
| `created_at` | timestamp | default now |
| `updated_at` | timestamp | nullable |

RLS: users manage their own rows (`user_id = app.current_user_id`)

#### `chats`
| Column | Type | Notes |
|---|---|---|
| `id` | varchar(191) PK | cuid2 |
| `created_at` | timestamp | default now |
| `title` | text NOT NULL | |
| `user_id` | varchar(255) NOT NULL | owner |
| `visibility` | enum `public\|private` | default `private` |
| `project_id` | varchar(191) FK → projects.id | nullable, SET NULL on delete |

RLS: users manage own chats; `public` chats are readable by all

#### `messages`
| Column | Type | Notes |
|---|---|---|
| `id` | varchar(191) PK | |
| `chat_id` | varchar(191) FK → chats.id | CASCADE DELETE |
| `role` | varchar | `user`, `assistant`, `system`, `tool` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | nullable |
| `metadata` | jsonb | arbitrary metadata |

RLS: accessible if user owns the parent chat

#### `parts`
Message content chunks — one message has many ordered parts.

| Column | Type | Notes |
|---|---|---|
| `id` | varchar(191) PK | |
| `message_id` | varchar(191) FK → messages.id | CASCADE DELETE |
| `order` | integer NOT NULL | sort order within message |
| `type` | varchar NOT NULL | part type (see below) |
| `created_at` | timestamp | |

**Part types and columns:**

| Type | Key columns |
|---|---|
| `text` | `text_text` |
| `reasoning` | `reasoning_text` |
| `file` | `file_media_type`, `file_filename`, `file_url` |
| `source-url` | `source_url_sourceId`, `source_url_url`, `source_url_title` |
| `source-document` | `source_document_*` (sourceId, mediaType, title, filename, url, snippet) |
| `tool-*` | `tool_toolCallId`, `tool_state`, `tool_errorText` + tool-specific JSON input/output |
| `data` | `data_prefix`, `data_content`, `data_id` |

Tool columns: `tool_search_input/output`, `tool_fetch_input/output`, `tool_question_input/output`, `tool_todoWrite_input/output`, `tool_todoRead_input/output`, `tool_dynamic_*`

Valid `tool_state` values: `input-streaming`, `input-available`, `output-available`, `output-error`

RLS: accessible if user owns the parent chat (via messages join)

#### `feedback`
| Column | Type | Notes |
|---|---|---|
| `id` | varchar(191) PK | |
| `user_id` | varchar(255) | nullable |
| `sentiment` | enum `positive\|neutral\|negative` | |
| `message` | text NOT NULL | |
| `page_url` | text NOT NULL | |
| `user_agent` | text | |
| `created_at` | timestamp | |

RLS: anyone can insert and read

### Relations (`lib/db/relations.ts`)

```
projects ──< chats ──< messages ──< parts
```

### Migrations

- Migration files: `/drizzle/*.sql` (currently 0000–0011)
- Schema source of truth: `lib/db/schema.ts`
- Generate migration: `bunx drizzle-kit generate`
- Apply: `bun migrate`
- **Always run `bun migrate` after pulling**

### Database Actions

| File | Purpose |
|---|---|
| `lib/db/actions.ts` | Low-level DB operations |
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
| `/api/projects/[id]` | GET/PUT/DELETE | Project operations |
| `/api/discover` | GET | Discover feed articles |
| `/api/advanced-search` | POST | Advanced SearXNG search |
| `/api/feedback` | POST | Submit feedback |
| `/api/upload` | POST | File upload (Cloudflare R2) |

---

## Environment Configuration

### Required Variables

```bash
OPENAI_API_KEY=       # Default AI provider
TAVILY_API_KEY=       # Default search provider
DATABASE_URL=         # PostgreSQL connection string
```

### AI Providers

| Provider | Env Var |
|---|---|
| OpenAI (default) | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Google Gemini | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Ollama (local) | `OLLAMA_BASE_URL` |

### Search Providers

| Provider | Env Var | Notes |
|---|---|---|
| Tavily (default) | `TAVILY_API_KEY` | Default |
| Exa | `EXA_API_KEY` | Neural search |
| SearXNG | `SEARXNG_API_URL` | Self-hosted |
| Brave | `BRAVE_SEARCH_API_KEY` | Optional; best for video/image |
| Firecrawl | `FIRECRAWL_API_KEY` | Web scraping |

### Optional Features

```bash
ENABLE_SAVE_CHAT_HISTORY=true   # Requires Redis
NEXT_PUBLIC_ENABLE_SHARE=true   # Enable link sharing
ENABLE_LANGFUSE_TRACING=true    # Observability
DATABASE_RESTRICTED_URL=        # app_user with RLS (recommended)
DATABASE_SSL_DISABLED=true      # Local/Docker only
```

### File Upload (Cloudflare R2)

```bash
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=user-uploads
R2_PUBLIC_URL=
```

---

## Key Development Patterns

1. **AI Streaming**: Vercel AI SDK streaming for real-time responses
2. **GenerativeUI**: Dynamic UI components based on AI responses
3. **Type Safety**: Strict TypeScript; no `any` unless unavoidable
4. **Schema Validation**: Zod schemas in `/lib/schema/` for all external data
5. **Error Handling**: Error boundaries and fallback UI components
6. **RSC-first**: Prefer React Server Components; use `"use client"` only when necessary
7. **RLS-first**: Always wrap DB writes and user-scoped reads in `withRLS()`

---

## Testing Approach

- Unit and integration tests with **Vitest**
- Test files co-located with source: `.test.ts` / `.test.tsx`
- **Run `bun run test`** (NOT `bun test` — that uses Bun's built-in runner which lacks Vitest features)
- CI runs `bun run test` on every PR

---

## Pre-PR Requirements

All of the following must pass before opening a PR:

1. `bun lint` — fix all ESLint errors/warnings (includes import sorting)
2. `bun typecheck` — no TypeScript errors
3. `bun format:check` — formatting correct (or run `bun format` to fix)
4. `bun run build` — production build succeeds
5. `bun run test` — all tests pass

Import sorting is handled by `eslint-plugin-simple-import-sort`. Run `bun lint --fix` to auto-sort.

---

## Model Configuration

Models defined in `public/config/models.json`:

- `id`: Model identifier
- `provider`: Display name
- `providerId`: Provider key for API routing
- `enabled`: Toggle availability
- `toolCallType`: `"native"` or `"manual"`
- `toolCallModel`: Optional override for tool calls

---

## MCP (Model Context Protocol) Integration

### Built-in Next.js MCP Server

Next.js 16 exposes a built-in MCP server at `http://localhost:3000/_next/mcp` when the dev server is running. No configuration needed.

**Available Tools:**

- `get_project_metadata` — project path and dev server URL
- `get_errors` — current error state (global, runtime, build)
- `get_page_metadata` — runtime metadata for current page renders
- `get_logs` — dev log file path
- `get_server_action_by_id` — locate Server Actions by ID

**Usage:**

1. Start the dev server: `bun dev`
2. MCP endpoint is automatically available at `/_next/mcp`
3. Claude Code will query real-time app state, errors, and logs

### Next DevTools MCP (External)

The `.mcp.json` in the project root enables the Next DevTools MCP package:

- Next.js knowledge base access
- Automated migration tools
- Cache optimisation guides
- Browser testing capabilities

Claude Code will prompt for approval before using project-scoped MCP servers.
