# Configuration Guide

This guide covers the optional features and their configuration in Morphic.

## Table of Contents

- [Database Setup](#database-setup)
- [Authentication](#authentication)
- [Chat History Storage](#chat-history-storage)
- [Search Providers](#search-providers)
- [Additional AI Providers](#additional-ai-providers)
- [Other Features](#other-features)

## Database Setup

The application uses PostgreSQL as the primary database with Prisma as the ORM.

### Option 1: Prisma Development Server (Recommended)

The easiest way to get started is using Prisma's built-in development server:

```bash
# Start Prisma development server with PostgreSQL
npx prisma dev

# Push database schema
npx prisma db push
```

Configure your `.env.local`:
```bash
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=[YOUR_API_KEY]"
```

### Option 2: Custom PostgreSQL Installation

If you prefer to use your own PostgreSQL installation:

```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create user and database
sudo -u postgres createuser --interactive
sudo -u postgres createdb dynamic_chat

# Configure password
sudo -u postgres psql
ALTER USER your_username PASSWORD 'your_password';
```

Configure your `.env.local`:
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/dynamic_chat"
```

## Authentication

The application uses NextAuth.js for authentication with Prisma adapter.

### Basic Configuration

Configure your `.env.local`:
```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-change-this-in-production
ADMIN_EMAIL=your-email@example.com
```

### Production Notes

- Generate a secure `NEXTAUTH_SECRET` for production
- Update `NEXTAUTH_URL` to your production domain
- Set `ADMIN_EMAIL` to grant admin access

## Chat History Storage

### Using Upstash Redis (Recommended for production)

Follow the detailed setup guide at [Building your own RAG chatbot with Upstash](https://upstash.com/blog/rag-chatbot-upstash#setting-up-upstash-redis)

1. Create a database at [Upstash Console](https://console.upstash.com/redis)
2. Navigate to the Details tab and find the "Connect your database" section
3. Copy the REST API credentials from the .env section
4. Configure your `.env.local`:

```bash
NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY=true
USE_LOCAL_REDIS=false
UPSTASH_REDIS_REST_URL=[YOUR_UPSTASH_REDIS_REST_URL]
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_REDIS_REST_TOKEN]
```

### Using Local Redis

1. Ensure Redis is installed and running locally
2. Configure your `.env.local`:

```bash
NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY=true
USE_LOCAL_REDIS=true
LOCAL_REDIS_URL=redis://localhost:6379
```

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

## Additional AI Providers

Models are configured in `public/config/models.json`. Each model requires its corresponding API key to be set in the environment variables.

### Model Configuration

The `models.json` file contains an array of model configurations with the following structure:

```json
{
  "models": [
    {
      "id": "model-id",
      "name": "Model Name",
      "provider": "Provider Name",
      "providerId": "provider-id",
      "enabled": true,
      "toolCallType": "native|manual",
      "toolCallModel": "tool-call-model-id" // optional, only needed if toolCallType is "manual" and you need to specify a different model for tool calls
    }
  ]
}
```

### Provider API Keys

### Google Generative AI

```bash
GOOGLE_GENERATIVE_AI_API_KEY=[YOUR_API_KEY]
```

### Anthropic

```bash
ANTHROPIC_API_KEY=[YOUR_API_KEY]
```

### Groq

```bash
GROQ_API_KEY=[YOUR_API_KEY]
```

### Ollama

```bash
OLLAMA_BASE_URL=http://localhost:11434
```

### Azure OpenAI

```bash
AZURE_API_KEY=[YOUR_API_KEY]
AZURE_RESOURCE_NAME=[YOUR_RESOURCE_NAME]
```

### DeepSeek

```bash
DEEPSEEK_API_KEY=[YOUR_API_KEY]
```

### Fireworks

```bash
FIREWORKS_API_KEY=[YOUR_API_KEY]
```

### xAI

```bash
XAI_API_KEY=[YOUR_XAI_API_KEY]
```

### OpenAI Compatible Model

```bash
OPENAI_COMPATIBLE_API_KEY=[YOUR_API_KEY]
OPENAI_COMPATIBLE_API_BASE_URL=[YOUR_API_BASE_URL]
```

## Other Features

### Share Feature

```bash
NEXT_PUBLIC_ENABLE_SHARE=true
```

### Video Search

```bash
SERPER_API_KEY=[YOUR_API_KEY]
```

### Alternative Retrieve Tool

```bash
JINA_API_KEY=[YOUR_API_KEY]
```
