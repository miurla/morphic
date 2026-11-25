# Docker Guide

## Tutor quick start

Follow the [README](../README.md#quick-start) to copy
`.env.docker.example` to `.env.local`, configure a chat provider, and run:

```bash
docker compose up -d --build
```

Open [Tutor](http://localhost:3000/tutor). Compose starts the application,
the Tutor worker, PostgreSQL with pgvector, Redis, SearXNG, and a local BGE-M3
embedding service. Database migrations run before the application starts.
Tutor uploads are stored in the `tutor_data` volume; no object storage account
is required for Tutor. Uploads in the separate general chat feature still use
[object storage](./CONFIGURATION.md).

The embedding image downloads and verifies model weights **at build time**.
The first build needs internet access and sufficient disk space for the runtime
images and the approximately 1.2 GB model. Once built, embedding inference needs
no model download or API key. The chat provider still needs network access and
may charge for API calls.

## CPU and GPU

The default configuration works without a GPU. CPU document processing can be
slow; it uses batches of four chunks and a three-minute request timeout.
On a host with NVIDIA GPU support configured for Docker, use:

```bash
docker compose -f docker-compose.yaml -f compose.gpu.yaml up -d --build
```

Keep using both files for subsequent GPU deployment commands. You can tune
`TUTOR_EMBEDDING_BATCH_SIZE` and `TUTOR_EMBEDDING_TIMEOUT_MS` in the shell or a
Compose `.env` file. They control batching and the timeout per request, not the
time limit for processing an entire document.

## Images and updates

The source deployment builds `morphic:tutor-local` and `tutor-embedding:bge-m3`.
The Docker workflow publishes separate application and embedding images to
`ghcr.io/pothomk/tutor` and `ghcr.io/pothomk/tutor-embedding`. A successful workflow
and public package visibility are required before anonymous users can pull them;
the source quick start does not depend on their availability.

To use published images, put these image selections in a Compose `.env` file:

```dotenv
MORPHIC_IMAGE=ghcr.io/pothomk/tutor:latest
TUTOR_EMBEDDING_IMAGE=ghcr.io/pothomk/tutor-embedding:bge-m3
```

Then pull and start without building:

```bash
docker compose pull
docker compose up -d --no-build
```

The embedding image contains pinned model weights at `/opt/tutor-models`.
Do not mount a volume over that path: it would hide the image\'s model files.
An older `tutor_embedding_models` volume is no longer used and is left intact.
The embedding API is only available on the internal Compose network.
See the [embedding image notes](../docker/embedding/README.md) for checksums,
licensing, and build details.

## Configuration precedence

`.env.local` supplies runtime credentials to the application and worker.
Compose\'s `environment` values take precedence over that file. Built-in local
database, storage, queue, and embedding settings require no user configuration.
For a custom embedding provider, see [Tutor configuration](./TUTOR.md).

Compose interpolation (`${VARIABLE}`) reads the shell or a project `.env` file,
not `.env.local`. For example, put `POSTGRES_PORT=5433` in `.env` to change the
host database port, or set `ENABLE_AUTH=true` there to enable authentication.

## Authentication

The default is anonymous, personal use: everyone accessing the instance shares
one identity and its data. Configure authentication before offering a shared
instance. See [Better Auth](./CONFIGURATION.md#better-auth) for built-in accounts.
Set `ENABLE_AUTH=true` in the Compose `.env` file and add the provider\'s runtime
settings to `.env.local`.

For Supabase, Next.js also needs its public browser configuration at build time.
Runtime secret keys stay in `.env.local`; environment files are excluded from
the image build context. Pass only public settings explicitly:

```bash
docker compose build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-key \
  morphic tutor-worker
docker compose up -d --no-build
```

Keep those public settings in `.env.local` as well for server-side use, alongside
`AUTH_PROVIDER=supabase` and `SUPABASE_SECRET_KEY`. The default published image
does not include a project\'s Supabase browser configuration.

## Useful commands

```bash
# Stop services while preserving database and uploaded files
docker compose down

# Follow document processing or application logs
docker compose logs -f tutor-worker morphic

# Rebuild after pulling source updates, then apply migrations and restart
docker compose up -d --build
```

Do not use `docker compose down -v` unless you intend to delete the database and
uploaded documents. Changing the embedding model, dimensions, provider URL, or
revision creates a different retrieval index; existing material must be uploaded
again to build vectors for the new index. See [Tutor](./TUTOR.md) for details.
