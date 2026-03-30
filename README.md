<div align="center">

# Morphic

An AI-powered search engine with a generative UI.

[![DeepWiki](https://img.shields.io/badge/DeepWiki-miurla%2Fmorphic-blue.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==)](https://deepwiki.com/miurla/morphic) [![GitHub stars](https://img.shields.io/github/stars/miurla/morphic?style=flat&colorA=000000&colorB=000000)](https://github.com/miurla/morphic/stargazers) [![GitHub forks](https://img.shields.io/github/forks/miurla/morphic?style=flat&colorA=000000&colorB=000000)](https://github.com/miurla/morphic/network/members)

<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>

<br />
<br />

<a href="https://trendshift.io/repositories/9207" target="_blank"><img src="https://trendshift.io/api/badge/repositories/9207" alt="miurla%2Fmorphic | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

<img src="./public/screenshot-2026-02-07.png" />

</div>

## Features

- AI-powered search with GenerativeUI
- Search modes: Quick and Adaptive
- Model selector with dynamic provider detection (OpenAI, Anthropic, Google, Ollama, Vercel AI Gateway)
- Multiple search providers (Tavily, SearXNG, Brave, Exa)
- Chat history stored in PostgreSQL
- Share search results with unique URLs
- File upload support
- User authentication with Supabase Auth
- Guest mode for anonymous usage
- Docker deployment ready

## Installation

### Docker (Recommended)

The quickest way to run Morphic locally:

```bash
docker pull ghcr.io/miurla/morphic:latest
```

Then set up with Docker Compose:

1. Clone the repository and configure environment:

```bash
git clone https://github.com/miurla/morphic.git
cd morphic
cp .env.local.example .env.local
```

2. Edit `.env.local` and set at least one AI provider API key:

```bash
OPENAI_API_KEY=your_openai_key
```

Other supported providers: Anthropic (`ANTHROPIC_API_KEY`), Google (`GOOGLE_GENERATIVE_AI_API_KEY`), Ollama (`OLLAMA_BASE_URL`), [Vercel AI Gateway](https://sdk.vercel.ai/docs/ai-sdk-core/settings#model) (`AI_GATEWAY_API_KEY` — access 200+ models through a single API). See [CONFIGURATION.md](./docs/CONFIGURATION.md) for details.

3. Start all services:

```bash
docker compose up -d
```

4. Visit http://localhost:3000 and select your model from the model selector.

Docker Compose starts PostgreSQL, Redis, SearXNG, and Morphic automatically. No additional search API key is needed — SearXNG is included.

See the [Docker Guide](./docs/DOCKER.md) for more options including building from source and file upload configuration.

### Local Development

1. Clone and install:

```bash
git clone https://github.com/miurla/morphic.git
cd morphic
bun install
```

2. Configure environment:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set your API keys:

```bash
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key
```

To enable chat history, authentication, file upload, and other features, see [CONFIGURATION.md](./docs/CONFIGURATION.md).

3. Start the dev server:

```bash
bun dev
```

Visit http://localhost:3000.

## Deploy

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmiurla%2Fmorphic&env=OPENAI_API_KEY,TAVILY_API_KEY,ENABLE_AUTH)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started, including local development setup.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
