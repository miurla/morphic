# Configuration Guide

This guide covers the optional features and their configuration in Morphic.

## Table of Contents

- [Database](#database)
- [AI Providers](#ai-providers)
- [Search Providers](#search-providers)
- [Authentication](#authentication)
- [Guest Mode](#guest-mode)
- [Other Features](#other-features)

## Database

Morphic uses PostgreSQL for chat history storage. A database is **optional** for basic usage — without it, Morphic runs in a stateless mode where chat history is not persisted.

### Setting Up PostgreSQL

Set the connection string in `.env.local`:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/morphic
```

Any PostgreSQL provider works: [Neon](https://neon.tech/), [Supabase](https://supabase.com/), or a local PostgreSQL instance.

**Docker**: Database is automatically configured — no need to set this.

### Running Migrations

After configuring your database, run migrations to create the necessary tables:

```bash
bun run migrate
```

This command applies all migrations from the `drizzle/` directory. Docker runs migrations automatically on startup.

## AI Providers

### Model Selection

Morphic dynamically detects available AI providers based on your API keys and displays a model selector in the UI. Set at least one provider API key to get started.

In **Local/Docker** mode, the selected model is persisted in a cookie and used for all chat interactions including related question generation.

In **Cloud** mode (`MORPHIC_CLOUD_DEPLOYMENT=true`), models are fixed by `config/models/cloud.json` and the model selector is not shown.

### Supported Providers

#### OpenAI

```bash
OPENAI_API_KEY=[YOUR_API_KEY]
```

#### Anthropic

```bash
ANTHROPIC_API_KEY=[YOUR_API_KEY]
```

#### Google Gemini

```bash
GOOGLE_GENERATIVE_AI_API_KEY=[YOUR_API_KEY]
```

#### Vercel AI Gateway

[Vercel AI Gateway](https://vercel.com/docs/ai-gateway) provides access to 200+ models through a single API.

```bash
AI_GATEWAY_API_KEY=[YOUR_AI_GATEWAY_API_KEY]
```

#### Ollama

[Ollama](https://ollama.com/) enables you to run large language models locally on your own hardware.

```bash
OLLAMA_BASE_URL=http://localhost:11434
```

When configured, Ollama models are discovered dynamically and appear in the model selector.

## Search Providers

### SearXNG Configuration

SearXNG can be used as an alternative search backend with advanced search capabilities. Docker Compose includes SearXNG automatically.

#### Basic Setup

```bash
SEARCH_API=searxng
SEARXNG_API_URL=http://localhost:8080
SEARXNG_SECRET=""  # generate with: openssl rand -base64 32
```

#### Advanced Configuration

```bash
# Search Behavior
SEARXNG_DEFAULT_DEPTH=basic  # Set to 'basic' or 'advanced'
SEARXNG_MAX_RESULTS=50
SEARXNG_ENGINES=google,bing,duckduckgo,wikipedia
SEARXNG_TIME_RANGE=None  # day, week, month, year, or None
SEARXNG_SAFESEARCH=0  # 0: off, 1: moderate, 2: strict

# Server
SEARXNG_PORT=8080
SEARXNG_BIND_ADDRESS=0.0.0.0
SEARXNG_IMAGE_PROXY=true
SEARXNG_LIMITER=false
```

#### Advanced Search Features

- `SEARXNG_DEFAULT_DEPTH`: Controls search depth
  - `basic`: Standard search
  - `advanced`: Includes content crawling and relevance scoring
- `SEARXNG_CRAWL_MULTIPLIER`: In advanced mode, determines how many results to crawl
  - Example: If `MAX_RESULTS=10` and `CRAWL_MULTIPLIER=4`, up to 40 results will be crawled

#### Customizing SearXNG

Modify `searxng-settings.yml` to enable/disable specific search engines, change UI settings, or adjust server options. See the [SearXNG documentation](https://docs.searxng.org/admin/settings/settings.html#settings-yml) for details.

### Brave Search (Optional)

Brave Search provides enhanced support for video and image searches:

```bash
BRAVE_SEARCH_API_KEY=[YOUR_BRAVE_SEARCH_API_KEY]
```

If not configured, `type="general"` searches fall back to your configured search provider.

## Authentication

By default, Morphic runs in **anonymous mode** (`ENABLE_AUTH=false`). This is ideal for personal, single-user environments.

### Anonymous Mode (Default)

```bash
ENABLE_AUTH=false
ANONYMOUS_USER_ID=anonymous-user
```

All users share a single anonymous user ID. No additional configuration needed.

### Enabling Supabase Authentication

For multi-user deployments:

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Set the following environment variables:

```bash
ENABLE_AUTH=true
NEXT_PUBLIC_SUPABASE_URL=[YOUR_SUPABASE_PROJECT_URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]
```

3. Obtain your credentials from the Supabase dashboard:
   - **Project URL**: Settings > API > Project URL
   - **Anon Key**: Settings > API > Project API keys > anon/public

## Guest Mode

Guest mode allows users to try Morphic without creating an account. Guest sessions are ephemeral — no chat history is stored.

### Enabling Guest Mode

```bash
ENABLE_GUEST_CHAT=true
```

### Guest Mode Behavior

- No authentication required
- No chat history saved
- Full context per request (client sends all messages)
- Disabled features: file upload, chat sharing, sidebar history

### Rate Limiting for Guests

For cloud deployments:

```bash
GUEST_CHAT_DAILY_LIMIT=10  # Maximum requests per IP per day
UPSTASH_REDIS_REST_URL=[YOUR_UPSTASH_URL]
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_TOKEN]
```

Rate limiting only applies when `MORPHIC_CLOUD_DEPLOYMENT=true`.

### Recommended Setup

| Environment    | Configuration                                |
| -------------- | -------------------------------------------- |
| Personal/Local | `ENABLE_AUTH=false` (anonymous mode)         |
| Public Demo    | `ENABLE_GUEST_CHAT=true` with rate limiting  |
| Production     | `ENABLE_AUTH=true` (Supabase authentication) |

## Other Features

### LLM Observability

Enable tracing and monitoring with Langfuse:

```bash
LANGFUSE_SECRET_KEY=[YOUR_SECRET_KEY]
LANGFUSE_PUBLIC_KEY=[YOUR_PUBLIC_KEY]
LANGFUSE_HOST=https://cloud.langfuse.com
```

### File Upload

Enable file upload with Cloudflare R2 or S3-compatible storage:

```bash
R2_ACCESS_KEY_ID=[YOUR_ACCESS_KEY]
R2_SECRET_ACCESS_KEY=[YOUR_SECRET_KEY]
R2_ACCOUNT_ID=[YOUR_ACCOUNT_ID]  # For Cloudflare R2
# S3_ENDPOINT=[YOUR_S3_ENDPOINT]  # Optional: generic S3-compatible endpoint
R2_BUCKET_NAME=[YOUR_BUCKET_NAME]
R2_PUBLIC_URL=[YOUR_PUBLIC_BASE_URL]
```

If storage variables are not configured, `/api/upload` returns `400` and uploads are disabled.

### Content Extraction

Use Jina for enhanced content extraction:

```bash
JINA_API_KEY=[YOUR_API_KEY]
```
