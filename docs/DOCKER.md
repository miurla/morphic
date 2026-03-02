# Docker Guide

This guide covers running Morphic with Docker, including development setup, prebuilt images, and deployment options.

## Quick Start with Docker Compose

1. Configure environment variables:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set the required variables:

```bash
DATABASE_URL=postgresql://morphic:morphic@postgres:5432/morphic
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key
BRAVE_SEARCH_API_KEY=your_brave_key
```

**Note**: Authentication is disabled by default (`ENABLE_AUTH=false` in `.env.local.example`).

**Optional**: Customize PostgreSQL credentials by setting environment variables in `.env.local`:

```bash
POSTGRES_USER=morphic      # Default: morphic
POSTGRES_PASSWORD=morphic  # Default: morphic
POSTGRES_DB=morphic        # Default: morphic
POSTGRES_PORT=5432         # Default: 5432
```

2. Start the Docker containers:

```bash
docker compose up -d
```

The application will:

- Start PostgreSQL 17 with health checks
- Start Redis for SearXNG search caching
- Wait for the database to be ready
- Run database migrations automatically
- Start the Morphic application
- Start SearXNG (optional search provider)

3. Visit http://localhost:3000 in your browser.

**Note**: Database data is persisted in a Docker volume. To reset the database, run:

```bash
docker compose down -v  # This will delete all data
```

## Using Prebuilt Image

Prebuilt Docker images are automatically built and published to GitHub Container Registry:

```bash
docker pull ghcr.io/miurla/morphic:latest
```

You can use it with docker-compose by setting the image in your `docker-compose.yaml`:

```yaml
services:
  morphic:
    image: ghcr.io/miurla/morphic:latest
    env_file: .env.local
    environment:
      DATABASE_URL: postgresql://morphic:morphic@postgres:5432/morphic
      DATABASE_SSL_DISABLED: 'true'
      ENABLE_AUTH: 'false'
    ports:
      - '3000:3000'
    depends_on:
      - postgres
      - redis
```

**Note**: The prebuilt image runs in **anonymous mode only** (`ENABLE_AUTH=false`). Supabase authentication cannot be enabled because `NEXT_PUBLIC_*` environment variables are embedded at build time by Next.js. To enable authentication or customize model configurations, you need to build from source — see [CONFIGURATION.md](./CONFIGURATION.md) for details.

## Building from Source

Use Docker Compose for a complete setup with PostgreSQL, Redis, and SearXNG. See the [Quick Start](#quick-start-with-docker-compose) section above.

## Useful Commands

```bash
# Start all containers in background
docker compose up -d

# Stop all containers
docker compose down

# Stop all containers and remove volumes (deletes database data)
docker compose down -v

# View logs
docker compose logs -f morphic

# Rebuild the image
docker compose build morphic
```
