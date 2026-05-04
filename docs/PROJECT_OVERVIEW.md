# Project Overview

## Purpose

**Morphic** is an open-source, AI-powered answer engine purpose-built for **AgriEvidence** — a platform that delivers evidence-based agricultural research to farmers, agronomists, researchers, and policymakers worldwide. It synthesises peer-reviewed literature, government extension data, and trusted agronomic sources into clear, cited answers through a generative UI.

---

## Tech Stack

### Core Framework

| Layer           | Technology           | Version |
| --------------- | -------------------- | ------- |
| Framework       | Next.js (App Router) | 15.5.5  |
| Runtime         | React                | 19.2.0  |
| Language        | TypeScript           | ^5      |
| Package Manager | Bun                  | 1.2.12  |

### AI & Streaming

| Component             | Technology                                              |
| --------------------- | ------------------------------------------------------- |
| AI SDK                | Vercel AI SDK (`ai`) v6                                 |
| Primary AI Provider   | DeepSeek V4 (Flash for speed, Pro for quality)          |
| Alternative Providers | OpenAI, Anthropic Claude, Google Gemini, Ollama (local) |
| AI Gateway            | Vercel AI Gateway (optional unified routing)            |
| Reasoning / Tracing   | Langfuse (optional, via `langfuse-vercel`)              |
| Telemetry             | OpenTelemetry + Vercel OTEL                             |

### Database & Persistence

| Component         | Technology                                             |
| ----------------- | ------------------------------------------------------ |
| Primary Database  | PostgreSQL (Supabase)                                  |
| ORM / Query Layer | Direct Supabase JS client (`@supabase/supabase-js` v2) |
| Auth Backend      | Supabase Auth (`@supabase/ssr`)                        |
| Rate-limit Cache  | Redis — Upstash (cloud) or local Redis                 |
| File Storage      | Cloudflare R2 / S3-compatible (AWS SDK v3)             |

### Search Providers

| Provider                             | Purpose                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| **Parallel Search** (`parallel-web`) | Default for AgriEvidence — agricultural domain retrieval |
| Tavily                               | General-purpose default (fallback)                       |
| SearXNG (self-hosted)                | Docker deployments — no API key required                 |
| Exa                                  | Neural search alternative                                |
| Brave Search                         | Video / image results                                    |
| Firecrawl                            | Web scraping & content extraction                        |
| Jina AI                              | Alternative content extraction                           |

### Frontend & UI

| Component           | Technology                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Styling             | Tailwind CSS v4                                                                                                                                          |
| UI Primitives       | Radix UI (alert dialog, avatar, checkbox, collapsible, dialog, dropdown, hover card, label, popover, select, separator, slider, switch, toggle, tooltip) |
| Component System    | shadcn/ui (`components.json`)                                                                                                                            |
| Icons               | Iconify Solar (`@iconify/react` + `@iconify-json/solar`)                                                                                                 |
| Math Rendering      | KaTeX (`katex`, `@streamdown/math`)                                                                                                                      |
| Markdown Streaming  | `streamdown` v2                                                                                                                                          |
| Toast Notifications | Sonner                                                                                                                                                   |
| Carousels           | Embla Carousel                                                                                                                                           |
| JSON Rendering      | `@json-render/core` / `@json-render/react`                                                                                                               |
| Themes              | `next-themes`                                                                                                                                            |
| Analytics           | Vercel Analytics                                                                                                                                         |

### Testing & Quality

| Tool                   | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| Vitest                 | Unit & integration tests (`bun run test`)                     |
| @testing-library/react | React component testing                                       |
| ESLint                 | Linting + import sorting (`eslint-plugin-simple-import-sort`) |
| Prettier               | Code formatting                                               |
| TypeScript `--noEmit`  | Type checking                                                 |

---

## Application Architecture

### Directory Layout

```
app/
  (app)/          # Authenticated shell
    chat/         # Chat session pages
    onboarding/   # Required agricultural profile wizard for new authenticated users
    search/       # Search result pages
  (marketing)/    # Public landing page
  api/
    chat/         # POST /api/chat — main AI streaming endpoint
    chats/        # Chat CRUD endpoints
    feedback/     # User feedback submission
    upload/       # File upload to R2/S3
    advanced-search/ # Advanced search API
  auth/           # Auth callback / Supabase redirects

lib/
  actions/        # Next.js Server Actions (chat, feedback)
  agents/         # AI agent definitions (researcher, title-generator)
  agri/           # AgriEvidence-specific: query-enricher, user context formatting
  analytics/      # Event tracking (Vercel Analytics)
  auth/           # getCurrentUser / getCurrentUserId helpers
  config/         # Model config, search modes, cookie helpers
  constants/      # Shared constants
  contexts/       # React contexts (UserProvider)
  firecrawl/      # Firecrawl client helper
  hooks/          # Shared server/lib hooks
  model-selector/ # Dynamic model selection logic
  models/         # Model registry helpers
  ollama/         # Ollama local model validator
  rate-limit/     # Chat limits, guest limits, adaptive (Quality) limits
  render/         # Message rendering utilities
  schema/         # Zod validation schemas
  storage/        # R2 / S3 client
  streaming/      # Stream creation helpers (chat, ephemeral)
  supabase/       # Supabase client factories + queries + types
  tools/          # AI tool implementations (search, fetch, question, todo)
  types/          # TypeScript type definitions
  utils/          # Shared utilities (id, message, model, telemetry, etc.)

components/       # All React UI components
  artifact/       # Search result / answer display
  sidebar/        # Chat history & navigation sidebar
  inspector/      # Dev/debug inspector panel
  marketing/      # Landing page components
  ui/             # shadcn/ui primitives

supabase/
  migrations/     # PostgreSQL migration SQL files
  seed/           # Seed data

config/
  models/         # Per-deployment model configs (cloud.json)

docs/             # Project documentation
public/           # Static assets, provider logos
scripts/          # CLI utilities (chat-cli.ts)
```

---

## Core Features

### 1. AI-Powered Answer Engine

- Users submit natural language questions via the chat interface
- The **Researcher agent** (`lib/agents/researcher.ts`) uses a `ToolLoopAgent` (Vercel AI SDK) that iterates with tools until a complete answer is synthesised
- Authenticated requests load `user_profiles` once in `app/api/chat/route.ts` and prepend agricultural context to the Researcher system prompt when available
- Two search modes:
  - **Speed** (`quick`) — DeepSeek V4 Flash, max 20 steps, tools: search + fetch
  - **Quality** (`adaptive`) — DeepSeek V4 Pro with extended reasoning, tools: search + fetch + todo planning

### 2. AgriEvidence Search Pipeline

- Raw queries are first **enriched** by `lib/agri/query-enricher.ts` using DeepSeek V4 Flash to expand informal language into precise scientific/agronomic terminology (2–3 sub-queries per input)
- For authenticated users, query enrichment receives request-scoped profile context (`primary_crops`, `climate_zone`, `country_code`) so generated sub-queries include relevant agronomic and geographic specificity
- The `agri-search` tool sends enriched queries to **Parallel Search** filtered against a Supabase `sources` table of curated trusted agricultural domains
- If trusted-domain results fall below a threshold (4 results), open-web fallback results supplement the response
- Trusted domain list is cached in memory (10-minute TTL)

### 3. Multi-Provider Search

- `lib/tools/search/providers/` implements a provider abstraction (`SearchProvider` base class)
- Supported: `tavily`, `exa`, `searxng`, `brave`, `firecrawl`
- Selected at runtime via `SEARCH_API` env var (default: `tavily`)

### 4. Generative UI / Streaming

- All AI responses stream to the client via the Vercel AI SDK
- `lib/streaming/create-chat-stream-response.ts` handles persistent chat sessions (saves to Supabase)
- `lib/streaming/create-ephemeral-chat-stream-response.ts` handles anonymous/guest sessions (no persistence)
- Parts (text, reasoning, tool outputs, file refs, source URLs) are stored individually in the `parts` table

### 5. Authentication & Multi-tenancy

- **Anonymous mode** (`ENABLE_AUTH=false`): all users share a single anonymous user ID — for personal/Docker deployments
- **Supabase Auth mode** (`ENABLE_AUTH=true`): full email/password + OAuth flows via `@supabase/ssr`
- The sign-up form collects `full_name` and writes it to the auto-created `user_profiles` row after registration
- Authenticated users with `onboarding_completed = false` are redirected by middleware to `/onboarding`; auth pages, API routes, and the wizard itself are excluded from this redirect
- Row-Level Security (RLS) enforced on every table
- Middleware (`middleware.ts`) refreshes Supabase sessions on every request

### 6. Rate Limiting

- **Guest limit** (`lib/rate-limit/guest-limit.ts`): caps searches for unauthenticated users
- **Chat limit** (`lib/rate-limit/chat-limits.ts`): per-user daily chat ceiling
- **Adaptive limit** (`lib/rate-limit/adaptive-limit.ts`): separate Redis-backed daily cap for Quality (adaptive) mode — default 30/day; enforced only in `MORPHIC_CLOUD_DEPLOYMENT=true` mode
- Limit events are tracked in Vercel Analytics

### 7. Chat History & Persistence

- Chats, messages, and message parts are stored in Supabase PostgreSQL
- `lib/actions/chat.ts` is the Server Actions interface for all chat CRUD
- `unstable_cache` wraps individual chat loads with per-chat cache tags
- Visibility can be `public` (shareable link) or `private`

### 8. Collections & Bookmarks

- Users can organise saved searches/chats into named **Collections**
- Individual **Bookmarks** can reference a chat session or a standalone URL
- Bookmarks support tags, notes, and thumbnail URLs

### 9. File Upload

- Users can attach files to queries via the chat panel
- Files are uploaded to **Cloudflare R2** (or any S3-compatible store) via `POST /api/upload`
- `lib/storage/r2-client.ts` provides a lazy-initialised `S3Client`

### 10. Alert Subscriptions

- Authenticated users can subscribe to push/email/webhook alerts for:
  - Pest outbreaks, disease reports, weather events, market prices, regulations, research publications
- Configurable keywords, geographic region filters, topics, and delivery frequency

### 11. Trending Queries & Analytics

- All searches are logged as append-only events in `search_events`
- A `trending_queries` table stores pre-aggregated daily/weekly/monthly trending queries by topic and region (populated by a cron/edge function)
- Full `pg_trgm` trigram indexing on the query text for fuzzy matching

### 12. Agricultural Taxonomy

- A hierarchical `topics` table provides a multi-level tagging system (root → subcategory → leaf)
- Topics include multilingual names (English, Spanish, French, Portuguese, Arabic, Hindi, Swahili)
- Chats are auto-tagged via the `chat_topics` junction table with a confidence score
- Sources are tagged via `source_topics` to express coverage

### 13. User Profiles

- Extended `user_profiles` table stores agricultural context: farm types, primary crops, farm size, country/region, climate zone, preferred language, subscription tier, and search quota
- Automatically created on first sign-up via a Postgres trigger (`on_auth_user_created`)
- `/onboarding` collects farm type, crops/products, farm size, country/region/climate, and preferred language, then updates `user_profiles` once with `onboarding_completed = true`
- Profile context personalises both the Researcher system prompt and DeepSeek V4 Flash query enrichment for authenticated chat requests

### 14. Title Generation

- `lib/agents/title-generator.ts` auto-generates descriptive chat titles from the first user message

### 15. Sharing

- Chats with `visibility = 'public'` are accessible by anyone with the link (enforced by RLS policy `chats_select_own_or_public`)

---

## Deployment Modes

| Mode               | Description                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Docker Compose** | Full local stack: PostgreSQL 17, Redis, Morphic app, SearXNG. Auth disabled by default.                           |
| **Vercel / Cloud** | Requires Supabase project, Redis (Upstash), and at least one AI + search API key.                                 |
| **Morphic Cloud**  | Official managed deployment. Auth enforced. `ENABLE_AUTH=false` blocked. Adaptive rate limits via Redis enforced. |

---

## Environment Variables Reference

### Required

| Variable           | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `DEEPSEEK_API_KEY` | Primary AI provider (AgriEvidence default)     |
| `PARALLEL_API_KEY` | Primary search provider (AgriEvidence default) |
| `DATABASE_URL`     | PostgreSQL connection string                   |

### Auth (optional)

| Variable                        | Purpose                                      |
| ------------------------------- | -------------------------------------------- |
| `ENABLE_AUTH`                   | `true` / `false` (default `false` in Docker) |
| `ANONYMOUS_USER_ID`             | Shared user ID when auth is disabled         |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key                            |

### Search (optional)

| Variable               | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `SEARCH_API`           | `tavily` \| `searxng` \| `exa` \| `firecrawl` \| `brave` |
| `TAVILY_API_KEY`       | Tavily                                                   |
| `EXA_API_KEY`          | Exa                                                      |
| `BRAVE_SEARCH_API_KEY` | Brave                                                    |
| `FIRECRAWL_API_KEY`    | Firecrawl                                                |
| `SEARXNG_API_URL`      | Self-hosted SearXNG URL                                  |
| `JINA_API_KEY`         | Jina AI content extraction                               |

### File Storage (optional)

| Variable               | Purpose                               |
| ---------------------- | ------------------------------------- |
| `R2_ACCOUNT_ID`        | Cloudflare R2 account                 |
| `S3_ENDPOINT`          | Generic S3-compatible endpoint        |
| `R2_ACCESS_KEY_ID`     | S3 access key                         |
| `R2_SECRET_ACCESS_KEY` | S3 secret key                         |
| `R2_BUCKET_NAME`       | Bucket name (default: `user-uploads`) |
| `R2_PUBLIC_URL`        | Public CDN URL                        |

### Redis / Rate Limiting (optional)

| Variable                    | Purpose                              |
| --------------------------- | ------------------------------------ |
| `LOCAL_REDIS_URL`           | Local Redis URL                      |
| `UPSTASH_REDIS_REST_URL`    | Upstash Redis URL                    |
| `UPSTASH_REDIS_REST_TOKEN`  | Upstash token                        |
| `ADAPTIVE_CHAT_DAILY_LIMIT` | Daily Quality-mode cap (default: 30) |

### Observability (optional)

| Variable                   | Purpose                                              |
| -------------------------- | ---------------------------------------------------- |
| `ENABLE_LANGFUSE_TRACING`  | Enable Langfuse tracing                              |
| `LANGFUSE_SECRET_KEY`      | Langfuse secret                                      |
| `LANGFUSE_PUBLIC_KEY`      | Langfuse public key                                  |
| `LANGFUSE_BASEURL`         | Langfuse base URL                                    |
| `ENABLE_PERF_LOGGING`      | Enable internal perf logging                         |
| `MORPHIC_CLOUD_DEPLOYMENT` | `true` for managed cloud; enables strict rate limits |

---

## Key Commands

```bash
bun dev          # Start dev server (http://localhost:3000)
bun run build    # Production build
bun start        # Production server
bun lint         # ESLint (includes import sort)
bun typecheck    # TypeScript check
bun format       # Prettier format
bun run test     # Vitest test suite
bun run test:watch # Tests in watch mode
docker compose up -d   # Full stack with Docker
```
