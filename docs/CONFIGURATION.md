# Configuration Guide

This guide covers the optional features and their configuration in Morphic.

## Table of Contents

- [Database](#database)
- [Authentication](#authentication)
- [Guest Mode](#guest-mode)
- [Search Providers](#search-providers)
- [Additional AI Providers](#additional-ai-providers)
- [Other Features](#other-features)

## Database

Morphic uses PostgreSQL for chat history storage. A database is **optional** for basic usage — without it, Morphic runs in a stateless mode where chat history is not persisted.

### Setting Up PostgreSQL

Set the connection string in `.env.local`:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/morphic
```

Any PostgreSQL provider works: [Neon](https://neon.tech/), [Supabase](https://supabase.com/), or a local PostgreSQL instance.

### Running Migrations

After configuring your database, run migrations to create the necessary tables:

```bash
bun run migrate
```

This command applies all migrations from the `drizzle/` directory.

## Authentication

By default, Morphic runs in **anonymous mode** with authentication disabled (`ENABLE_AUTH=false` in `.env.local.example`). This is ideal for personal use where all users share a single anonymous user ID.

### Anonymous Mode (Default)

No configuration needed. The default settings in `.env.local.example` include:

```bash
ENABLE_AUTH=false
ANONYMOUS_USER_ID=anonymous-user
```

**⚠️ Important**: Anonymous mode is only suitable for personal, single-user environments. All chat history is shared under one user ID.

### Enabling Supabase Authentication

To enable user authentication with Supabase:

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Set the following environment variables in `.env.local`:

```bash
ENABLE_AUTH=true
NEXT_PUBLIC_SUPABASE_URL=[YOUR_SUPABASE_PROJECT_URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]
```

3. Obtain your credentials from the Supabase dashboard:
   - **Project URL**: Settings → API → Project URL
   - **Anon Key**: Settings → API → Project API keys → anon/public

With authentication enabled, users will need to sign up/login to use Morphic, and each user will have isolated chat history.

## Guest Mode

Guest mode allows users to try Morphic without creating an account. Guest sessions are ephemeral - no chat history is stored in the database.

### Enabling Guest Mode

Set the following environment variable:

```bash
ENABLE_GUEST_CHAT=true
```

### Guest Mode Behavior

When guest mode is enabled:

- **No authentication required**: Users can start chatting immediately
- **No chat history**: Messages are not saved to the database
- **Full context per request**: The client sends all messages with each request to maintain conversation context
- **No URL navigation**: Guests stay on the root path (no `/search/[id]` URLs)
- **Disabled features**:
  - File upload
  - Quality mode (forced to "Speed")
  - Chat sharing
  - Sidebar history

### Rate Limiting for Guests

For cloud deployments, you can limit guest usage per IP address:

```bash
GUEST_CHAT_DAILY_LIMIT=10  # Maximum requests per IP per day (default: 10)
```

Rate limiting requires Redis (Upstash) configuration:

```bash
UPSTASH_REDIS_REST_URL=[YOUR_UPSTASH_URL]
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_TOKEN]
```

**Note**: Rate limiting only applies when `MORPHIC_CLOUD_DEPLOYMENT=true`. For self-hosted deployments, rate limiting is disabled by default.

### Recommended Setup

| Environment    | Configuration                                |
| -------------- | -------------------------------------------- |
| Personal/Local | `ENABLE_AUTH=false` (anonymous mode)         |
| Public Demo    | `ENABLE_GUEST_CHAT=true` with rate limiting  |
| Production     | `ENABLE_AUTH=true` (Supabase authentication) |

## Search Providers

### SearXNG Configuration

SearXNG can be used as an alternative search backend with advanced search capabilities.

#### Basic Setup

1. Set up SearXNG as your search provider:

```bash
SEARCH_API=searxng
SEARXNG_API_URL=http://localhost:8080
SEARXNG_SECRET=""  # generate with: openssl rand -base64 32
```

#### Docker Setup

1. Ensure you have Docker and Docker Compose installed
2. Two configuration files are provided in the root directory:
   - `searxng-settings.yml`: Contains main configuration for SearXNG
   - `searxng-limiter.toml`: Configures rate limiting and bot detection

#### Advanced Configuration

1. Configure environment variables in your `.env.local`:

```bash
# SearXNG Base Configuration
SEARXNG_PORT=8080
SEARXNG_BIND_ADDRESS=0.0.0.0
SEARXNG_IMAGE_PROXY=true

# Search Behavior
SEARXNG_DEFAULT_DEPTH=basic  # Set to 'basic' or 'advanced'
SEARXNG_MAX_RESULTS=50  # Maximum number of results to return
SEARXNG_ENGINES=google,bing,duckduckgo,wikipedia  # Comma-separated list of search engines
SEARXNG_TIME_RANGE=None  # Time range: day, week, month, year, or None
SEARXNG_SAFESEARCH=0  # 0: off, 1: moderate, 2: strict

# Rate Limiting
SEARXNG_LIMITER=false  # Enable to limit requests per IP
```

#### Advanced Search Features

- `SEARXNG_DEFAULT_DEPTH`: Controls search depth
  - `basic`: Standard search
  - `advanced`: Includes content crawling and relevance scoring
- `SEARXNG_MAX_RESULTS`: Maximum results to return
- `SEARXNG_CRAWL_MULTIPLIER`: In advanced mode, determines how many results to crawl
  - Example: If `MAX_RESULTS=10` and `CRAWL_MULTIPLIER=4`, up to 40 results will be crawled

#### Customizing SearXNG

You can modify `searxng-settings.yml` to:

- Enable/disable specific search engines
- Change UI settings
- Adjust server options

Example of disabling specific engines:

```yaml
engines:
  - name: wikidata
    disabled: true
```

For detailed configuration options, refer to the [SearXNG documentation](https://docs.searxng.org/admin/settings/settings.html#settings-yml)

#### Troubleshooting

- If specific search engines aren't working, try disabling them in `searxng-settings.yml`
- For rate limiting issues, adjust settings in `searxng-limiter.toml`
- Check Docker logs for potential configuration errors:

```bash
docker-compose logs searxng
```

### Brave Search (Optional)

Brave Search provides enhanced support for video and image searches when used as a general search provider:

```bash
BRAVE_SEARCH_API_KEY=[YOUR_BRAVE_SEARCH_API_KEY]
```

Get your API key at: https://brave.com/search/api/

**Features:**

- Multiple content types in single search (web, video, image, news)
- Optimized for multimedia content with thumbnails
- Direct video duration and metadata support
- Used automatically when `type="general"` is specified in search queries

**Fallback Behavior:**
If `BRAVE_SEARCH_API_KEY` is not configured, `type="general"` searches will automatically fall back to your configured optimized search provider. Video and image searches will still work but may have limited multimedia support depending on the provider.

## Additional AI Providers

Models are configured in `config/models/*.json` files. Each provider requires its corresponding API key to be set in the environment variables.

### Model Configuration

Model configuration files use the following structure:

```json
{
  "version": 1,
  "models": {
    "byMode": {
      "quick": {
        "speed": {
          "id": "model-id",
          "name": "Model Name",
          "provider": "Provider Name",
          "providerId": "provider-id",
          "providerOptions": {}
        },
        "quality": {
          "id": "model-id",
          "name": "Model Name",
          "provider": "Provider Name",
          "providerId": "provider-id",
          "providerOptions": {}
        }
      },
      "adaptive": {
        "speed": {
          "id": "model-id",
          "name": "Model Name",
          "provider": "Provider Name",
          "providerId": "provider-id",
          "providerOptions": {}
        },
        "quality": {
          "id": "model-id",
          "name": "Model Name",
          "provider": "Provider Name",
          "providerId": "provider-id",
          "providerOptions": {}
        }
      }
    },
    "relatedQuestions": {
      "id": "model-id",
      "name": "Model Name",
      "provider": "Provider Name",
      "providerId": "provider-id"
    }
  }
}
```

Define all four combinations to control which model runs for every search mode (`quick`, `adaptive`) and preference (`speed`, `quality`). For example, you can pair `quick/speed` with `gemini-2.5-flash-lite` while keeping `adaptive/quality` on GPT-5. The default config ships with OpenAI models for every slot so Morphic works out-of-the-box.

### Supported Providers

#### OpenAI (Default)

```bash
OPENAI_API_KEY=[YOUR_API_KEY]
```

#### Google Generative AI

```bash
GOOGLE_GENERATIVE_AI_API_KEY=[YOUR_API_KEY]
```

#### Anthropic

```bash
ANTHROPIC_API_KEY=[YOUR_API_KEY]
```

#### Vercel AI Gateway

[Vercel AI Gateway](https://vercel.com/docs/ai-gateway) allows you to use multiple AI providers through a single endpoint with automatic failover and load balancing.

```bash
AI_GATEWAY_API_KEY=[YOUR_AI_GATEWAY_API_KEY]
```

#### Ollama

[Ollama](https://ollama.com/) enables you to run large language models locally on your own hardware.

**Configuration:**

```bash
OLLAMA_BASE_URL=http://localhost:11434
```

Then update your `config/models/*.json` files to use Ollama models:

```json
{
  "id": "qwen3:latest",
  "name": "Qwen 3",
  "provider": "Ollama",
  "providerId": "ollama"
}
```

**Important Notes:**

- **Tools Capability**: Morphic requires models to support the `tools` capability for function calling. On server startup, Morphic validates configured models and logs the results. Note that even if a model reports tools support, actual tool calling performance depends on the model's capabilities and is not guaranteed.

- **Validation Logs**: Check server logs on startup to verify your configured models:
  ```
  ✓ qwen3:latest (configured and tools supported)
  ✗ deepseek-r1:latest (configured but lacks tools support)
  ```

## Other Features

### LLM Observability

Enable tracing and monitoring with Langfuse:

```bash
LANGFUSE_SECRET_KEY=[YOUR_SECRET_KEY]
LANGFUSE_PUBLIC_KEY=[YOUR_PUBLIC_KEY]
LANGFUSE_HOST=https://cloud.langfuse.com
```

### File Upload

Enable file upload with Cloudflare R2:

```bash
CLOUDFLARE_R2_ACCESS_KEY_ID=[YOUR_ACCESS_KEY]
CLOUDFLARE_R2_SECRET_ACCESS_KEY=[YOUR_SECRET_KEY]
CLOUDFLARE_R2_ACCOUNT_ID=[YOUR_ACCOUNT_ID]
CLOUDFLARE_R2_BUCKET_NAME=[YOUR_BUCKET_NAME]
```

### Alternative Fetch Tool

Use Jina for enhanced content extraction:

```bash
JINA_API_KEY=[YOUR_API_KEY]
```
