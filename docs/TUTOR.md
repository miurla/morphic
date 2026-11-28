# Tutor

Tutor is a document-grounded learning workspace at `/tutor`. It uses the existing
Morphic theme, authentication and English / Simplified Chinese language settings.
It accepts up to 20 PDF, plain text (`.txt`), Markdown (`.md`, `.markdown`), or
Word (`.docx`) files, 20 MiB per file and 200 MiB per course by default. Scanned PDFs need a text layer; pages with
little extracted text are reported to the learner instead of silently being
treated as fully understood. PDF citations retain page previews and highlights;
other documents show the cited text and a download link to the original file.
Plain text and Markdown support UTF-8 or UTF-16 with a byte-order mark. A course
can contain at most 1,000 PDF pages or logical text segments in total; each PDF
can have at most 500 pages. Non-PDF text is grouped into segments of roughly
10,000 characters for this limit. Text, token and chunk budgets apply separately:
a file fitting the byte limit is not necessarily small enough to process.

### Upload and parsing budgets

The form uploads up to three files concurrently, reports transfer progress, and
allows individual files to be removed/cancelled or retried. Invalid selections
are reported individually while valid files continue. Originals are streamed to
private temporary files while checking their byte count and SHA-256; completed
files are stored locally or streamed to the configured object store.

An uploaded file is not yet ready for learning. The existing Tutor worker first
parses it in an isolated process, saves the reusable parse and reports page/text
segment, token and chunk counts. Course creation waits for parsing and checks the
combined budget before embedding or calling the teaching model. A failed parse
can be retried without uploading the original again. Scans still require OCR
outside Tutor; encrypted or damaged files report a parsing error.

Configure the following values identically on Web and Worker. The default Docker
stack reads these optional settings from `.env.local` for both services. Restart
both processes after changing them. Limits are admission policy; lowering the
upload size does not make existing stored originals unreadable.

Apply migration `0024_tutor_document_preparation` before deploying this version,
and update/restart Web and Worker together. The new UI sends raw binary uploads
with an encoded `x-tutor-filename` header; the upload route performs authentication,
origin and maintenance checks itself and bypasses Proxy request-body cloning.
Parsing failures are manually retryable; course and chapter jobs retain their
existing automatic retry policy. This release does not add OCR or embedding-batch
checkpoints.

| Environment variable        | Default | Meaning                                           |
| --------------------------- | ------: | ------------------------------------------------- |
| `TUTOR_MAX_FILES`           |      20 | Unique documents per course                       |
| `TUTOR_MAX_FILE_SIZE_MB`    |      20 | MiB per newly uploaded file                       |
| `TUTOR_MAX_COURSE_SIZE_MB`  |     200 | Combined original MiB per course                  |
| `TUTOR_UPLOAD_CONCURRENCY`  |       3 | Browser upload concurrency (1–4)                  |
| `TUTOR_MAX_PDF_PAGES`       |     500 | Pages per PDF                                     |
| `TUTOR_MAX_COURSE_PAGES`    |    1000 | Total PDF pages/logical text segments             |
| `TUTOR_MAX_TEXT_CHARACTERS` | 2000000 | Extracted characters per document                 |
| `TUTOR_MAX_DOCUMENT_TOKENS` |  500000 | Processing tokens per document                    |
| `TUTOR_MAX_COURSE_TOKENS`   |  500000 | Processing tokens per course                      |
| `TUTOR_MAX_DOCUMENT_CHUNKS` |    2000 | Chunks per document                               |
| `TUTOR_MAX_COURSE_CHUNKS`   |    5000 | Chunks per course                                 |
| `TUTOR_PARSE_TIMEOUT_MS`    |  120000 | Parser process execution deadline                 |
| `TUTOR_PARSE_MEMORY_MB`     |     512 | Parser V8 heap limit; not a total OS memory limit |

Only bounded positive integers are accepted; invalid settings use their defaults.
DOCX archive expansion protection remains independent of the upload byte limit.
These defaults are resource ceilings, not a processing-time guarantee. Measure
peak memory, parsing/indexing duration and learning coverage on the deployment's
actual hardware before increasing them. Larger collections may need separate
courses because course-planning and lesson-context budgets remain bounded.

## Default Docker deployment

Follow the [README quick start](../README.md#quick-start): copy
`.env.docker.example` to `.env.local`, configure the teaching/chat API, and run:

```sh
docker compose up -d --build
```

The default stack starts the Web app, Tutor worker, local BGE-M3 embedding and
reranking services, PostgreSQL with pgvector, Redis and SearXNG. No profiles or separate
model-download commands are needed. Document storage and queue addresses are
configured by Compose. Web and Worker share the database, Redis and the durable
`tutor_data` document volume. The Web entrypoint applies migrations before the
worker starts. The embedding endpoint is accessible only within the Compose
network; the default stack does not publish its port on the host.

The teaching model uses the first nonempty `OPENAI_COMPATIBLE_MODELS` entry when
its API key and base URL are configured. This is implemented in
`getTutorModelId()`; no `TUTOR_MODEL` setting is needed for the default compatible
provider. Other teaching providers and explicit model selection are described
under [advanced configuration](#configuration).

### Bundled BGE-M3 image

The embedding service has its own image, `tutor-embedding:bge-m3`, separate from
the application's `morphic:tutor-local` image. Its Dockerfile downloads and
verifies the approximately 1.2 GB BGE-M3 GGUF model during the first build and
packages it in the image. That first build needs network access; container
images and application dependencies also need to be fetched. Subsequent starts
use the packaged model. Cached rebuilds reuse the model layer, while clearing
the cache or changing the model version can cause another download.

This removes the manual `ollama pull` step. It does not eliminate transferring
the model: a source build downloads it during construction, and a prebuilt-image
installation downloads it as part of the image layers.

Compose supplies the following embedding settings to both Web and Worker:

| Setting                                 | Docker default                    |
| --------------------------------------- | --------------------------------- |
| Authentication                          | `none`                            |
| Base URL                                | `http://tutor-embedding:11434/v1` |
| Model                                   | `bge-m3`                          |
| Dimensions                              | `1024`                            |
| Send the `dimensions` request parameter | `false`                           |
| Batch size                              | `4` texts per request             |
| Request timeout                         | `180000` milliseconds             |

The local service requires no API key or placeholder. In `none` authentication
mode Tutor ignores both embedding and OpenAI API keys and sends no
`Authorization` header. The teaching/chat provider retains its own credentials.

The model files are image content, not data that users need to populate in a
volume. Do not mount an old model volume over the packaged model directory:
that would hide the image's files. A `docker commit` of an old Ollama container
does not include the contents of its mounted model volume.

### CPU and optional GPU

CPU inference is the default. A compatible NVIDIA GPU can be enabled with:

```sh
docker compose -f docker-compose.yaml -f compose.gpu.yaml up -d --build
```

GPU use requires a Docker Compose version supporting the GPU configuration and
working NVIDIA GPU access from Linux containers. On Windows, use Docker Desktop
with its WSL2 backend and compatible GPU drivers. Start with a short document
when checking CPU latency or a newly loaded model.

The default batch size and timeout favor CPU use. To tune them, set
`TUTOR_EMBEDDING_BATCH_SIZE` and `TUTOR_EMBEDDING_TIMEOUT_MS` in your shell or
Compose's project `.env` file, then recreate the services. Compose reads these
interpolation values from the shell or `.env`, not `.env.local`. Smaller batches
reduce the amount of work in each request; a longer timeout allows slower
inference to finish. Both Web and Worker should use the same settings.

### Updating and publishing images

After a source update, rebuild with `docker compose up -d --build` (including
the GPU override when used). Back up existing PostgreSQL data before applying
migrations, and retain database and document volumes when updating.

The [Docker build workflow](../.github/workflows/docker-build.yml) publishes the
application and embedding images separately. The intended packages for this
repository are `ghcr.io/pothomk/tutor` and
`ghcr.io/pothomk/tutor-embedding`. A workflow definition is not proof that those
packages have been published or made public. Verify a successful workflow run,
package visibility and the desired tags before configuring a registry-only
deployment. The source-build quick start does not depend on public GHCR images.

See [Docker deployment](./DOCKER.md) for image and deployment options. The upstream
Morphic image does not include this fork's Tutor code or bundled embedding model.

## Run locally for development

Development outside Compose needs its own service configuration. Use Node.js
22.13+ and Bun for the lockfile:

```sh
cp .env.local.example .env.local
bun install --frozen-lockfile
```

Configure a PostgreSQL database with pgvector, a Redis TCP/TLS endpoint, document
storage, a teaching model and an embedding service in `.env.local`. Use the
[configuration section](#configuration) below; `.env.docker.example` only covers
the settings required by the managed Docker stack.

To use the bundled embedding image from host-based Web and Worker processes,
build it and run a separate development container with an explicit loopback
port mapping:

```sh
docker compose build tutor-embedding
docker run -d --name tutor-embedding-dev -p 127.0.0.1:11434:11434 tutor-embedding:bge-m3
```

This standalone container is for host-based development; the default Compose
embedding service remains internal to its network. Set
`TUTOR_EMBEDDING_BASE_URL=http://127.0.0.1:11434/v1` in `.env.local`, together with
`TUTOR_EMBEDDING_AUTH=none`, model `bge-m3`, dimensions `1024` and
`TUTOR_EMBEDDING_SEND_DIMENSIONS=false`. If containers access Ollama running
directly on the Windows host instead, use `http://host.docker.internal:11434/v1`
and ensure its listener is reachable from Docker.

Apply migrations and run the Web process:

```sh
bun migrate
bun run dev
```

Run the long-lived background worker in a separate terminal:

```sh
bun run tutor:worker
```

Web and Worker must use the same database, Redis, document storage, teaching
model and embedding configuration. Their embedding base URLs must also match
exactly because the URL is part of the document index identity. Setting
`OLLAMA_BASE_URL` alone configures the chat provider, not the embedding endpoint.
The PDF.js browser worker is copied from the installed package during `dev` and
`build`; it is not loaded from a third-party CDN.

## Configuration

This section covers local development and custom deployments. The default Docker
stack already supplies its internal database, queue, storage and embedding
settings. Compose `environment` entries take precedence over `.env.local`;
changing those values in `.env.local` alone does not override the Docker defaults.

For processes running outside Compose, configure the required services in
`.env.local`, for example:

```dotenv
# PostgreSQL with permission to install the vector extension.
DATABASE_URL=postgresql://...
# Optional restricted application role, if one is configured.
# DATABASE_RESTRICTED_URL=postgresql://...

# Redis TCP/TLS, not an HTTP Redis REST endpoint.
TUTOR_REDIS_URL=redis://127.0.0.1:6379
TUTOR_WORKER_CONCURRENCY=2

TUTOR_STORAGE_DRIVER=local
TUTOR_LOCAL_STORAGE_DIR=.tutor-files

# Local bundled BGE-M3, exposed from Docker to the host.
TUTOR_EMBEDDING_AUTH=none
TUTOR_EMBEDDING_BASE_URL=http://127.0.0.1:11434/v1
TUTOR_EMBEDDING_MODEL=bge-m3
TUTOR_EMBEDDING_DIMENSIONS=1024
TUTOR_EMBEDDING_SEND_DIMENSIONS=false
TUTOR_EMBEDDING_BATCH_SIZE=4
TUTOR_EMBEDDING_TIMEOUT_MS=180000
```

Configure teaching credentials separately. For an OpenAI-compatible chat service,
set `OPENAI_COMPATIBLE_API_KEY`, `OPENAI_COMPATIBLE_API_BASE_URL` and
`OPENAI_COMPATIBLE_MODELS`. Tutor selects the first model unless `TUTOR_MODEL`
explicitly specifies a `provider:model` pair. Other registry providers use their
existing credentials: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
`GOOGLE_GENERATIVE_AI_API_KEY`, `AI_GATEWAY_API_KEY`, or `OLLAMA_BASE_URL`.
The selected teaching model must support structured JSON output. If no compatible
model or explicit teaching model is set, Tutor can use the application's default
OpenAI model when that provider is configured.

### Cloud embedding services

To use BGE-M3 through SiliconFlow outside Docker, add the following settings to
`.env.local` along with the teaching model and other services:

```dotenv
TUTOR_EMBEDDING_AUTH=bearer
TUTOR_EMBEDDING_API_KEY=your_siliconflow_key
TUTOR_EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
TUTOR_EMBEDDING_MODEL=BAAI/bge-m3
TUTOR_EMBEDDING_DIMENSIONS=1024
TUTOR_EMBEDDING_SEND_DIMENSIONS=false
```

Create the key in the [SiliconFlow console](https://cloud.siliconflow.cn/).
BGE-M3 returns native 1024-dimensional dense vectors. This example uses those
native dimensions and omits the optional `dimensions` request parameter. Check
the [model specification](https://huggingface.co/BAAI/bge-m3) and current
[provider API contract](https://api-docs.siliconflow.cn/docs/api/embeddings-post)
when choosing another model or changing its request parameters.

For the default Docker stack, also override the fixed embedding `environment`
entries for **both** Web and Worker. For example, create
`compose.cloud-embedding.yaml`:

```yaml
services:
  morphic:
    environment: &cloud-embedding
      TUTOR_EMBEDDING_AUTH: bearer
      TUTOR_EMBEDDING_BASE_URL: https://api.siliconflow.cn/v1
      TUTOR_EMBEDDING_MODEL: BAAI/bge-m3
      TUTOR_EMBEDDING_DIMENSIONS: '1024'
      TUTOR_EMBEDDING_SEND_DIMENSIONS: 'false'
  tutor-worker:
    environment: *cloud-embedding
```

Keep `TUTOR_EMBEDDING_API_KEY` in `.env.local`, which both services read, and run:

```sh
docker compose -f docker-compose.yaml -f compose.cloud-embedding.yaml up -d --build
```

This switches embedding requests to the cloud. To remove the unused local
embedding container as well, adjust its service definition and the application
services' dependencies in your custom Compose configuration.

`TUTOR_EMBEDDING_AUTH` defaults to `bearer` outside the managed Docker settings.
Bearer mode requires `TUTOR_EMBEDDING_API_KEY` or falls back to `OPENAI_API_KEY`.
It does not reuse arbitrary compatible-chat credentials. Its base URL falls back
to `OPENAI_BASE_URL`, then `https://api.openai.com/v1`, and the default model is
`text-embedding-3-small` with 1536 dimensions. Tutor appends `/embeddings` to the
base URL. Set the model and dimensions to values supported by your provider.

For an unauthenticated endpoint, `TUTOR_EMBEDDING_AUTH=none` requires an explicit
`TUTOR_EMBEDDING_BASE_URL`, ignores both API key variables and sends no
`Authorization` header. Switch back to `bearer` when using a cloud API.
Changing only the authentication mode or key does not change index identity.

### Vector dimensions and existing courses

`TUTOR_EMBEDDING_DIMENSIONS` must match the vectors returned by the model.
`TUTOR_EMBEDDING_SEND_DIMENSIONS=false` omits the optional request parameter for
fixed-dimension models; returned vectors are still validated against the
configured dimension. Apply migration `0023` before using dimensions other than 1536. Docker startup applies migrations automatically. Migration `0023` removes
the column's fixed dimension without changing existing stored vectors.

The endpoint URL, model, dimensions and `TUTOR_EMBEDDING_REVISION` (default: `1`)
form the index identity. A changed identity never silently queries old vectors.
Re-uploading the same file under new settings creates a separate document version;
old courses retain their original lessons, citations, questions and assessments.
To generate new chapters in an old course, restore its original index settings
or create a new course from the newly uploaded version. This also applies when
switching from cloud BGE-M3 to the bundled local model: the endpoint and model ID
change even though both use BGE-M3.

### Storage, queue and authentication

The default Docker stack provides private local storage in the shared
`tutor_data` volume and a Redis TCP queue. For custom deployments, Web and Worker
need the same durable storage and queue. S3/R2 uses the existing `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` and `S3_ENDPOINT` or `R2_ACCOUNT_ID`
settings. Keep local document directories outside public web assets.

Redis URLs must use `redis://` or `rediss://`; HTTP Redis REST credentials do not
serve the Tutor worker queue. A configured queue without a running worker leaves
jobs queued. The worker logs `[Tutor worker] Ready` after startup. Configuration
checks do not prove that network access, credentials or model capabilities work.

The default anonymous mode represents one personal, shared local identity. See
[authentication configuration](./CONFIGURATION.md) before sharing a deployment.
Files can be selected even when setup is incomplete; operations requiring a
missing service report an error through the normal application notification.

## Learning and assessment behavior

1. Uploads are validated by bytes and size, hashed, stored privately, and scoped
   to the current user. Duplicate bytes reuse the same stored object.
2. The worker extracts document text (plus normalized source regions for PDFs),
   builds structured parent/child chunks, and obtains real embeddings. Non-PDF
   source segments are not displayed as physical page numbers. No fabricated
   vector or model response is used by production code.
3. All source units participate in topic extraction. Completed planning batches
   are checkpointed so a retry can reuse them. Larger topic indexes are compacted
   in bounded layers while retaining their original evidence IDs. The final
   planning payload is capped at 16,000 tokens and 80 topics; material that still
   exceeds the limit must be split into smaller courses. The learning goal and baseline
   influence the route, while the learner's self-reported level does not increase
   mastery.
4. Chapters are generated on demand. Every knowledge point has a concept,
   worked example, conceptual question and practical exercise. Each generated
   source ID is checked against the retrieved, authorized evidence.
5. Questions store their original evidence, reference answer and rubric on the
   server. Public course responses exclude reference answers and rubrics.
6. Grading uses that fixed evidence and rubric. The server sums validated
   criterion scores; missing evidence does not become a zero mark. Submissions
   use idempotency IDs and a per-user/question Redis lease to avoid concurrent
   duplicate grading.
7. Mastery is the average of knowledge-point scores. A knowledge-point score is
   the average of the latest valid results for all of its published questions;
   unanswered questions count as unassessed (zero). Repeating a question updates
   its score instead of accumulating points, and a lower later score may reduce
   mastery.

Generation and document indexing have bounded retries. Ready courses, documents
and chapters cannot be downgraded by late failures. Up to three course-processing
jobs may be active per user. Database commits are idempotent, but a remote provider
may still charge for a response lost during a crash; exactly-once external billing
is not promised.

UI language changes apply immediately. Existing lessons remain in the course's
creation language; newly submitted assessment feedback follows the current
request language. Source quotes retain their original language.

## RAG strategy

The initial configuration uses roughly 450-token child chunks, up to 600 tokens;
parent groups target 1400 tokens, up to 1800. Real headings provide retrieval
context. Original text and source geometry are retained for citations.

Retrieval combines exact pgvector similarity and PostgreSQL full-text search,
with Chinese pre-segmentation and identifier preservation. Each path applies
the current user/course scope. Reciprocal Rank Fusion combines ranks. Parent
expansion returns actual sibling source IDs, not invented citations pointing
to text outside a chunk. Context packing is token-bounded.

PostgreSQL's built-in rank function is not BM25. HNSW, GraphRAG, embedding fine
tuning and automatic multi-query agents are not required for this first version.

Docker Compose enables `BAAI/bge-reranker-v2-m3` after rank fusion for both
Web and Worker. The llama.cpp image bundles the Q8_0 GGUF weights, which are
downloaded and checked against their SHA-256 on the first image build. The
`compose.gpu.yaml` override enables NVIDIA acceleration for both model services.
The `/rerank` endpoint stays on the Compose network. To disable rerank requests,
set `TUTOR_RERANK_ENABLED=false` in the shell or Compose project's `.env` file.

For Tutor running directly on the host, reranking is opt-in. Configure a
reachable service that accepts the `/rerank` request and response format used
by llama.cpp. Set `TUTOR_RERANK_AUTH=none` for a trusted local endpoint that
accepts requests without a bearer token. By default Tutor uses bearer auth:

```dotenv
TUTOR_RERANK_ENABLED=true
TUTOR_RERANK_BASE_URL=https://your-provider.example/v1
TUTOR_RERANK_API_KEY=...
TUTOR_RERANK_MODEL=...
```

If the reranker is unavailable or returns an error, retrieval keeps the
original order and records `rerank: failed` in the retrieval trace.
Enabling reranking is an experiment, not a claim that quality
has improved.

## Validation and evaluation

```sh
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run build
```

Tutor-specific unit tests cover document parsing, citations, chunk coverage,
retrieval, grading validation, mastery, API authorization and UI behavior.

For isolated PostgreSQL / Redis integration tests:

```sh
docker compose -f compose.tutor-test.yaml up -d --wait
# Set TUTOR_TEST_DATABASE_URL to the isolated database URL in that file.
bun run test:tutor
```

Never point test variables at a production database. The integration tests create
and verify a non-owner role so RLS is exercised, rather than bypassed by a database
owner. The optional browser/API smoke tools in `scripts/tutor-smoke` use an
explicit loopback-only test AI provider; passing those tests proves wiring and
interaction, not model teaching quality.

For actual retrieval evaluation:

```sh
bun run eval:tutor dataset.json
bun run eval:tutor dataset.json --rerank
```

Each JSON dataset item contains:

```json
{
  "id": "example-1",
  "userId": "authorized-test-user",
  "courseId": "an-indexed-course",
  "query": "A question with manually identified evidence",
  "relevantSourceIds": ["a-real-source-id"],
  "split": "test",
  "tags": ["cross-language"]
}
```

The runner compares vector and hybrid retrieval, optionally reranking, and reports
recall, ranking, evidence coverage, latency and traces. Validation/test splits
cannot share course/document content. It invokes the configured embedding service and
can incur provider charges. Cross-chunking experiments require annotations against
original document spans, since chunk IDs change. Citation correctness and grading
quality additionally need human-reviewed examples; schema-valid references alone
do not prove that a source supports a conclusion.
