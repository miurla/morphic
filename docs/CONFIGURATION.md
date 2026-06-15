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

#### Google Fact Check

A key for Google Fact Check Tools API. If not set, the tool falls back to `GOOGLE_GENERATIVE_AI_API_KEY` or `GOOGLE_MAPS_API_KEY`.

```bash
GOOGLE_FACT_CHECK_API_KEY=[YOUR_API_KEY]
```

To show snippet-level evidence checks under assistant answers, enable claim verification:

```bash
ENABLE_CLAIM_VERIFICATION=true
```

When Google Fact Check results are present in a response, the evidence panel includes them as claim-review signals alongside ordinary citations.

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

#### Ollama Cloud

Ollama Cloud uses the hosted Ollama API with bearer-token authentication. It is separate from local Ollama so the model selector can show local and cloud models independently.

```bash
OLLAMA_API_KEY=[YOUR_OLLAMA_API_KEY]
OLLAMA_CLOUD_BASE_URL=https://ollama.com
```

Morphic discovers cloud models from `/api/tags` and sends chat requests through the Ollama SDK provider. If you want to pin the visible models and skip cloud model discovery on startup, set:

```bash
OLLAMA_CLOUD_MODELS=gpt-oss:120b,qwen3:235b
```

Users can also add their own Ollama Cloud API key from Settings. User keys are stored in an HttpOnly cookie, are never returned by the settings API, and take precedence over `OLLAMA_API_KEY`.

Ollama tag discovery does not currently return a complete per-model capability object, so Morphic infers the capabilities it needs for chat selection:

- `chat`, `streaming`, and `toolCalling` are required for models shown in the selector.
- `thinking` is enabled only for known thinking model families. GPT-OSS uses `think=medium`; Qwen3, DeepSeek R1, and similar reasoning families use `think=true`.
- `vision` is marked for known multimodal families such as Gemma vision, Qwen VL, LLaVA, and Moondream.
- `structuredOutputs` is marked for local Ollama only. Ollama Cloud models are not marked structured-output capable by default.
- `webSearch` is marked for Ollama Cloud chat models because hosted cloud models can use Ollama's cloud web-search tools.
- Embedding, rerank, moderation, image, audio, and speech models are filtered out of Morphic chat model selection.

#### OpenAI-Compatible Providers

Use OpenAI-compatible endpoints for providers such as DeepSeek, Moonshot, Zhipu, Together, or a self-hosted gateway that exposes the OpenAI chat completions API.

```bash
OPENAI_COMPATIBLE_API_KEY=[YOUR_API_KEY]
OPENAI_COMPATIBLE_API_BASE_URL=https://api.deepseek.com
```

Morphic sends chat requests to `/v1/chat/completions`. You can provide either a base URL with or without `/v1`; both of these resolve to the same endpoint:

```bash
OPENAI_COMPATIBLE_API_BASE_URL=https://api.deepseek.com
OPENAI_COMPATIBLE_API_BASE_URL=https://api.deepseek.com/v1
```

The model selector tries to load models from `/v1/models`. If your provider does not expose that endpoint, or you want to restrict the choices shown in the UI, set a comma-separated model list:

```bash
OPENAI_COMPATIBLE_MODELS=deepseek-chat,deepseek-reasoner
```

You can also customize the provider label shown in the model selector:

```bash
OPENAI_COMPATIBLE_PROVIDER_NAME=DeepSeek
```

This value is only a UI display name. The internal provider id remains `openai-compatible`.

**Example: OrcaRouter**

[OrcaRouter](https://www.orcarouter.ai) is an OpenAI-compatible endpoint that fronts 160+ models from OpenAI, Anthropic, Google, DeepSeek, xAI and others behind one API key. To use it with Morphic:

```bash
OPENAI_COMPATIBLE_API_KEY=sk-orca-...
OPENAI_COMPATIBLE_API_BASE_URL=https://api.orcarouter.ai/v1
OPENAI_COMPATIBLE_PROVIDER_NAME=OrcaRouter
# Pin a few tool-capable models so Morphic's research agents work out of the box.
# Browse the full catalog at https://www.orcarouter.ai/models
OPENAI_COMPATIBLE_MODELS=orcarouter/openai/gpt-5.5,orcarouter/anthropic/claude-opus-4.7,orcarouter/google/gemini-3-flash-preview
```

Morphic's research agents rely on tool calling, so make sure any model you select supports it. Restricting `OPENAI_COMPATIBLE_MODELS` to known tool-capable models (as above) is the simplest way to keep the selector clean and avoid hitting non-tool-capable upstreams.

#### OpenRouter

[OpenRouter](https://openrouter.ai/) provides a unified interface to access a wide variety of models.

```bash
OPENROUTER_API_KEY=[YOUR_OPENROUTER_API_KEY]
```

By default, Morphic will fetch available models from the OpenRouter models API. If you want to pin a custom whitelist of models to display in the UI and avoid calling their endpoint on startup, define the models statically:

```bash
OPENROUTER_MODELS=google/gemini-2.5-flash,meta-llama/llama-3.3-70b-instruct,deepseek/deepseek-chat
```

Morphic's adaptive researcher uses an OpenRouter-inspired router pattern: simple questions search directly, while complex or high-cost questions use independent evidence paths, sub-agents, fact-checking, and a final self-review for consensus, contradictions, blind spots, and source quality.

OpenRouter beta server tools are supported as an explicit opt-in. Morphic validates the `providerOptions.openrouter.serverTools` schema before the AI SDK call, carries the validated config through an internal request header, strips that header in the OpenRouter provider adapter, and appends OpenRouter's beta server-tool contracts to the outgoing JSON request body only for OpenRouter models.

```bash
OPENROUTER_SERVER_TOOLS_ENABLED=true
OPENROUTER_SERVER_TOOLS=fusion,advisor
OPENROUTER_FUSION_ANALYSIS_MODELS=~google/gemini-flash-latest,~anthropic/claude-sonnet-latest
OPENROUTER_FUSION_JUDGE_MODEL=~openai/gpt-latest
OPENROUTER_ADVISOR_MODEL=~anthropic/claude-opus-latest
OPENROUTER_ADVISOR_TOOLS=web_search
```

Fusion requires at least one configured analysis model or judge model. Advisor requires a configured advisor model. Invalid or over-broad config fails closed and no beta server tools are attached.

Private prompt experiments should stay local. Add override files to `prompts.local/quick.md`, `prompts.local/adaptive.md`, or `prompts.local/router.md`; these paths are gitignored. Overrides are appended by default with a safety boundary. Local-only deployments can replace a prompt explicitly:

```bash
MORPHIC_PROMPT_OVERRIDES_DIR=./prompts.local
MORPHIC_PROMPT_OVERRIDE_MODE=replace
```

The Settings page also includes Personalization controls. These are sanitized before being added to model instructions and are treated only as user preference context, not as authority over source, citation, privacy, or security rules.

## Search Providers

### SearXNG Configuration

SearXNG can be used as an alternative search backend with advanced search capabilities. Docker Compose includes SearXNG automatically.

#### Basic Setup

```bash
SEARCH_API=searxng
SEARXNG_API_URL=http://localhost:8080
SEARXNG_SECRET=""  # generate with: openssl rand -base64 32
```

Qwant is the default search provider. To use Qwant without a Qwant API key, run SearXNG and select the Qwant-backed provider:

```bash
SEARCH_API=qwant
SEARXNG_API_URL=http://localhost:8080
```

Qwant does not publish a supported public search API for application developers. Morphic's Qwant option routes searches through SearXNG's Qwant engine instead of scraping Qwant result pages directly.

DuckDuckGo can be selected the same way:

```bash
SEARCH_API=duckduckgo
SEARXNG_API_URL=http://localhost:8080
```

DuckDuckGo's official endpoint (`https://api.duckduckgo.com/`) is an Instant Answer API, not a full search-results API. Morphic's DuckDuckGo option routes searches through SearXNG's DuckDuckGo engine so the app can return normal result lists without adding DuckDuckGo page scraping to Morphic.

#### Advanced Configuration

```bash
# Search Behavior
SEARXNG_DEFAULT_DEPTH=basic  # Set to 'basic' or 'advanced'
SEARXNG_MAX_RESULTS=50
SEARXNG_ENGINES=google,bing,duckduckgo,wikipedia
SEARXNG_TIME_RANGE=None  # day, week, month, year, or None
SEARXNG_SAFESEARCH=0  # 0: off, 1: moderate, 2: strict

# Server
SEARXNG_HOST_PORT=8080
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
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[YOUR_SUPABASE_PUBLISHABLE_KEY]
# Required for account deletion. Keep server-side only.
SUPABASE_SECRET_KEY=[YOUR_SUPABASE_SECRET_KEY]
```

3. Obtain your credentials from the Supabase dashboard:
   - **Project URL**: Settings > API > Project URL
   - **Publishable Key**: Settings > API Keys > publishable key (`sb_publishable_...`)
   - **Secret Key**: Settings > API Keys > secret key (`sb_secret_...`)

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
