# Docker Guide

## Quick Start

### Using Prebuilt Image (Recommended)

1. Pull the latest image:

```bash
docker pull ghcr.io/miurla/morphic:latest
```

2. Configure environment:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set at least one AI provider API key:

```bash
OPENAI_API_KEY=your_openai_key
```

Other supported providers: Anthropic (`ANTHROPIC_API_KEY`), Google (`GOOGLE_GENERATIVE_AI_API_KEY`), Ollama (`OLLAMA_BASE_URL`), Vercel AI Gateway (`AI_GATEWAY_API_KEY`).

3. Start all services:

```bash
docker compose up -d
```

4. Visit http://localhost:3000 and select your model from the model selector.

### Building from Source

To build locally instead of using the prebuilt image:

```bash
docker compose up -d --build
```

## What Docker Compose Starts

- **PostgreSQL 17** - Database with automatic migrations
- **Redis** - SearXNG search caching
- **SearXNG** - Self-hosted search engine (no external search API key needed)
- **Morphic** - The application

## Model Selection

In Docker mode, Morphic dynamically detects available AI providers based on your API keys and displays a model selector in the UI. No configuration files to edit — just set your API key and pick your model.

## Built-in Defaults

Docker Compose automatically sets these for you:

- `ENABLE_AUTH=false` (anonymous mode)
- `SEARCH_API=searxng`
- `SEARXNG_API_URL=http://searxng:8080`
- `LOCAL_REDIS_URL=redis://redis:6379`
- `MORPHIC_CLOUD_DEPLOYMENT=false`

Values in `docker-compose.yaml` take precedence over `.env.local`. To override a default:

```bash
SEARCH_API=tavily docker compose up -d
```

## File Upload

File upload requires externally reachable object storage. Docker Compose does not provision storage by default.

Required environment variables:

- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`
- One of: `R2_ACCOUNT_ID` (Cloudflare R2) or `S3_ENDPOINT` (generic S3-compatible)

If these are not set, upload is disabled.

## PostgreSQL Configuration

Customize database credentials in `.env.local`:

```bash
POSTGRES_USER=morphic      # Default: morphic
POSTGRES_PASSWORD=morphic  # Default: morphic
POSTGRES_DB=morphic        # Default: morphic
POSTGRES_PORT=5432         # Default: 5432
```

Database data is persisted in a Docker volume. To reset:

```bash
docker compose down -v  # Deletes all data
```

## Enabling Authentication

By default, Docker runs in anonymous mode — all users share a single anonymous user ID. This is intended for **personal, single-user local environments only**.

To enable Supabase authentication for multi-user deployments:

1. Set up a [Supabase](https://supabase.com/) project
2. Build from source with the Supabase environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
ENABLE_AUTH=true
```

3. Build and start:

```bash
docker compose up -d --build
```

**Note**: The prebuilt image does not support authentication because `NEXT_PUBLIC_*` variables are embedded at build time by Next.js. You must build from source to enable authentication.

## Useful Commands

```bash
# Start all containers
docker compose up -d

# Stop all containers
docker compose down

# Stop and remove volumes (deletes database data)
docker compose down -v

# View logs
docker compose logs -f morphic

# Rebuild the image
docker compose build morphic
```
