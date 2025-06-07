# Morphic

An AI-powered search engine with a generative UI.

![capture](/public/screenshot-2025-05-04.png)

## 🗂️ Overview

- 🛠 [Features](#-features)
- 🧱 [Stack](#-stack)
- 🚀 [Quickstart](#-quickstart)
- 🌐 [Deploy](#-deploy)
- 🔎 [Search Engine](#-search-engine)
- 💙 [Sponsors](#-sponsors)
- 👥 [Contributing](#-contributing)
- 📄 [License](#-license)

📝 Explore AI-generated documentation on [DeepWiki](https://deepwiki.com/miurla/morphic)

## 🛠 Features

### Core Features

- AI-powered search with GenerativeUI
- Natural language question understanding
- Multiple search providers support (Tavily, SearXNG, Exa)
- Model selection from UI (switch between available AI models)
  - Reasoning models with visible thought process

### Authentication

- User authentication powered by [Supabase Auth](https://supabase.com/docs/guides/auth)
- Supports Email/Password sign-up and sign-in
- Supports Social Login with Google

### Chat & History

- Chat history functionality (Optional)
- Share search results (Optional)
- Redis support (Local/Upstash)

### AI Providers

The following AI providers are supported:

- OpenAI (Default)
- Google Generative AI
- Azure OpenAI
- Anthropic
- Ollama
- Groq
- DeepSeek
- Fireworks
- xAI (Grok)
- OpenAI Compatible

Models are configured in `public/config/models.json`. Each model requires its corresponding API key to be set in the environment variables. See [Configuration Guide](docs/CONFIGURATION.md) for details.

### Search Capabilities

- URL-specific search
- Video search support (Optional)
- SearXNG integration with:
  - Customizable search depth (basic/advanced)
  - Configurable engines
  - Adjustable results limit
  - Safe search options
  - Custom time range filtering

### Additional Features

- Docker deployment ready
- Browser search engine integration

## 🧱 Stack

### Core Framework

- [Next.js](https://nextjs.org/) - App Router, React Server Components
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vercel AI SDK](https://sdk.vercel.ai/docs) - Text streaming / Generative UI

### Authentication & Authorization (Updated Category)

- [Supabase](https://supabase.com/) - User authentication and backend services

### AI & Search

- [OpenAI](https://openai.com/) - Default AI provider (Optional: Google AI, Anthropic, Groq, Ollama, Azure OpenAI, DeepSeek, Fireworks)
- [Tavily AI](https://tavily.com/) - Default search provider
- Alternative providers:
  - [SearXNG](https://docs.searxng.org/) - Self-hosted search
  - [Exa](https://exa.ai/) - Neural search

### Data Storage

- [Upstash](https://upstash.com/) - Serverless Redis
- [Redis](https://redis.io/) - Local Redis option

### UI & Styling

- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - Re-usable components
- [Radix UI](https://www.radix-ui.com/) - Unstyled, accessible components
- [Lucide Icons](https://lucide.dev/) - Beautiful & consistent icons

## 🚀 Quickstart

### 1. Fork and Clone repo

Fork the repo to your Github account, then run the following command to clone the repo:

```bash
git clone git@github.com:[YOUR_GITHUB_ACCOUNT]/morphic.git
```

### 2. Install dependencies

```bash
cd morphic
bun install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the required environment variables in `.env.local`:

```bash
# Required for Core Functionality
OPENAI_API_KEY=     # Get from https://platform.openai.com/api-keys
TAVILY_API_KEY=     # Get from https://app.tavily.com/home
```

For optional features configuration (Redis, SearXNG, etc.), see [CONFIGURATION.md](./docs/CONFIGURATION.md)

### 4. Run app locally

#### Using Bun

```bash
bun dev
```

#### Using Docker

```bash
docker compose up -d
```

Visit http://localhost:3000 in your browser.

## 🌐 Deploy

Host your own live version of Morphic with Vercel, Cloudflare Pages, or Docker.

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmiurla%2Fmorphic&env=OPENAI_API_KEY,TAVILY_API_KEY,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN)

### Docker Prebuilt Image

Prebuilt Docker images are available on GitHub Container Registry:

```bash
docker pull ghcr.io/miurla/morphic:latest
```

You can use it with docker-compose:

```yaml
services:
  morphic:
    image: ghcr.io/miurla/morphic:latest
    env_file: .env.local
    ports:
      - '3000:3000'
    volumes:
      - ./models.json:/app/public/config/models.json # Optional: Override default model configuration
```

The default model configuration is located at `public/config/models.json`. For Docker deployment, you can create `models.json` alongside `.env.local` to override the default configuration.

## 🔎 Search Engine

### Setting up the Search Engine in Your Browser

If you want to use Morphic as a search engine in your browser, follow these steps:

1. Open your browser settings.
2. Navigate to the search engine settings section.
3. Select "Manage search engines and site search".
4. Under "Site search", click on "Add".
5. Fill in the fields as follows:
   - **Search engine**: Morphic
   - **Shortcut**: morphic
   - **URL with %s in place of query**: `https://morphic.sh/search?q=%s`
6. Click "Add" to save the new search engine.
7. Find "Morphic" in the list of site search, click on the three dots next to it, and select "Make default".

This will allow you to use Morphic as your default search engine in the browser.

## 💙 Sponsors

This project is proudly supported by:

<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>

## 👥 Contributing

We welcome contributions to Morphic! Whether it's bug reports, feature requests, or pull requests, all contributions are appreciated.

Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- How to submit issues
- How to submit pull requests
- Commit message conventions
- Development setup

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
