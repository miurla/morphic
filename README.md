# Tutor

A document-grounded learning workspace built on [Morphic](https://github.com/miurla/morphic).
Upload your materials, generate a learning path, study lessons with source
citations, and practice with assessed feedback.

## Features

- Learn from PDF, TXT, Markdown and DOCX files.
- Generate chapters, explanations, worked examples and practice questions.
- Follow citations back to source text, including PDF page highlights.
- Track assessed mastery and revisit saved lessons and answers.
- Use English or Simplified Chinese.
- Run locally with Docker, including a bundled BGE-M3 embedding model.

Morphic's search workspace is also available at the main application URL.

## Quick start

Install Docker with Docker Compose and run the following commands. CPU inference
is the default; a GPU is optional.

```sh
git clone https://github.com/PothomK/Tutor.git
cd Tutor
cp .env.docker.example .env.local
```

Edit `.env.local` to configure your teaching/chat API. For example, with DeepSeek:

```dotenv
OPENAI_COMPATIBLE_API_KEY=your_deepseek_api_key
OPENAI_COMPATIBLE_API_BASE_URL=https://api.deepseek.com
OPENAI_COMPATIBLE_MODELS=deepseek-chat
```

Use a model available to your account that supports structured JSON output.
Tutor uses the first model in `OPENAI_COMPATIBLE_MODELS` for teaching. The API
provider bills teaching-model usage according to your account's plan.

Build and start Tutor:

```sh
docker compose up -d --build
```

Open [http://localhost:3000/tutor](http://localhost:3000/tutor).
Compose starts the Web app, background worker, BGE-M3 embedding service,
PostgreSQL, Redis and SearXNG. It configures document storage and applies database
migrations automatically. The teaching/chat API is the only required setup.

**The first build needs network access.** It downloads and verifies the roughly
1.2 GB BGE-M3 model into the embedding image, in addition to container images and
application dependencies. Once built, startup uses that model locally. Cached
rebuilds reuse the model layer; there is no separate model-download command.
Changing model versions or clearing the build cache can require another download.

For NVIDIA GPU acceleration with a compatible Docker setup, use:

```sh
docker compose -f docker-compose.yaml -f compose.gpu.yaml up -d --build
```

## Try a lesson

1. Open Tutor and upload a document you know well. Each file can be up to 5 MB;
   a course accepts up to five files.
2. Enter a learning goal and choose your starting level.
3. Study a chapter, check its citations, and answer its practice questions.
4. Review the feedback against the original material.

Scanned PDFs need a text layer. Start with a short document to evaluate coverage,
citation accuracy and grading quality.

## Development and configuration

- [Tutor setup and evaluation](./docs/TUTOR.md): local development, model changes,
  CPU tuning, cloud embeddings and retrieval evaluation.
- [Docker deployment](./docs/DOCKER.md): deployment and image details.
- [Configuration](./docs/CONFIGURATION.md): authentication and optional features.
- [Privacy](./docs/PRIVACY.md): outbound requests and optional integrations.

For development outside Docker, use `.env.local.example` and configure the
required database, Redis, storage and model services as described in the Tutor
guide. The Docker defaults are intended for personal use; configure authentication
before sharing an instance.

To inspect startup or rebuild after a source update:

```sh
docker compose ps
docker compose logs --tail=100 tutor-worker
docker compose up -d --build
```

Keep the database and document volumes when updating an existing installation.

## Credits and license

Tutor builds on [Morphic](https://github.com/miurla/morphic), an open-source AI
search engine by miurla and its contributors. This fork adds the document-grounded
learning workflow while retaining the underlying search experience.

The application source is licensed under [Apache License 2.0](./LICENSE).
See the [contributing guide](./CONTRIBUTING.md) for contribution instructions.
