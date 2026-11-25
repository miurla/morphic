# Tutor

Tutor is a document-grounded learning workspace at `/tutor`. It uses the existing
Morphic theme, authentication and English / Simplified Chinese language settings.
It accepts up to five PDF, plain text (`.txt`), Markdown (`.md`, `.markdown`), or
Word (`.docx`) files, 5 MB per file. Scanned PDFs need a text layer; pages with
little extracted text are reported to the learner instead of silently being
treated as fully understood. PDF citations retain page previews and highlights;
other documents show the cited text and a download link to the original file.
Plain text and Markdown support UTF-8 or UTF-16 with a byte-order mark. A course
can contain at most 200 PDF pages or logical text segments in total; non-PDF text
is grouped into segments of roughly 10,000 characters for this limit.

## Run locally

Use Node.js 22.13+ (the existing Docker image uses Node 22) and Bun for the lockfile.

```sh
bun install --frozen-lockfile
bun migrate
bun run dev
```

Run the long-lived background worker in a separate terminal:

```sh
bun run tutor:worker
```

The worker and Web process must use the same database, Redis, document storage,
embedding configuration and model configuration. The PDF.js browser worker is
copied from the installed package during `dev` and `build`; it is not loaded from
a third-party CDN.

## Configuration

Add the following settings to `.env.local` as appropriate. Do not commit secrets.

```dotenv
# Existing PostgreSQL database, with permission to install the vector extension.
DATABASE_URL=postgresql://...
# Use the existing restricted application role where configured.
DATABASE_RESTRICTED_URL=postgresql://...

# Existing AI SDK registry key: provider:model. The model must support JSON output.
TUTOR_MODEL=openai:gpt-5.4-mini

# Embeddings are a separate capability from chat completions.
TUTOR_EMBEDDING_API_KEY=...
TUTOR_EMBEDDING_BASE_URL=https://api.openai.com/v1
TUTOR_EMBEDDING_MODEL=text-embedding-3-small
TUTOR_EMBEDDING_REVISION=1

# A Redis TCP/TLS endpoint, not an HTTP Redis REST endpoint.
TUTOR_REDIS_URL=redis://localhost:6379
TUTOR_WORKER_CONCURRENCY=2
# Optional: public origin when a reverse proxy changes the Host or protocol.
# TUTOR_PUBLIC_ORIGIN=https://learn.example.com
```

`TUTOR_MODEL` can be omitted when `OPENAI_COMPATIBLE_MODELS` supplies a configured
compatible model, or when the existing default OpenAI model is configured.
Embedding credentials fall back to `OPENAI_API_KEY`; they do not automatically
reuse arbitrary compatible-chat credentials. The embedding endpoint must support
1536-dimensional vectors. Its URL, model, dimensions and explicit revision form
the index identity. A changed identity never silently queries old vectors.
Re-uploading the same file under new index settings creates a separate document
version; old courses keep their original evidence. To continue generating chapters
in an old course, restore its index configuration, or create a new course from the
newly uploaded version.

Original files use the project's existing S3/R2 settings. For an explicit local
single-machine setup, both processes can instead use:

```dotenv
TUTOR_STORAGE_DRIVER=local
TUTOR_LOCAL_STORAGE_DIR=.tutor-files
```

Keep this directory outside public web assets and back it up with the database.
Local storage requires a shared durable directory if Web and Worker run in
different containers or machines. The bundled Compose configuration mounts the
same `tutor_data` volume at `/app/tutor-data` in both processes. Set
`TUTOR_STORAGE_DRIVER=local` in `.env.local` to use it, or keep S3/R2 configured.

Files can be selected or dropped even when service setup is incomplete. Missing
configuration is reported through the normal error notification when an action
requires that service. Configuration checks do not prove that credentials,
provider capabilities, or network access work. The worker logs `[Tutor worker] Ready`
when it has started; a configured queue without a running worker leaves jobs queued.

## Docker

PostgreSQL uses the `pgvector/pgvector:pg17` image. Existing PostgreSQL 17 data
remains in its named volume; no volume deletion is part of setup. Back up an
existing database before changing deployment images or applying migrations.

```sh
docker compose --profile tutor up -d --build
```

The local image is tagged `morphic:tutor-local` (override with `MORPHIC_IMAGE`).
To start only the main app while embedding credentials are being configured:

```sh
docker compose up -d --build
```

Once embeddings are configured, start the worker with
`docker compose --profile tutor up -d tutor-worker`.

The Web entrypoint applies migrations, and `tutor-worker` starts the dedicated
Node process after the Web health check succeeds. Compose explicitly points both
processes at `redis://redis:6379`, overriding a host-local `TUTOR_REDIS_URL` in
`.env.local`. To use an external queue, override that setting for both services.
Redis enables AOF and `noeviction`. Configure authenticated access
for a deployment shared by multiple users; the existing anonymous mode represents
one shared local identity.

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

Optional reranking is disabled by default:

```dotenv
TUTOR_RERANK_ENABLED=true
TUTOR_RERANK_BASE_URL=https://your-provider.example/v1
TUTOR_RERANK_API_KEY=...
TUTOR_RERANK_MODEL=...
```

The provider must accept the `/rerank` request/response contract implemented in
`lib/tutor/retrieval.ts`. A reranker failure falls back to RRF and is recorded in
the retrieval trace. Enabling reranking is an experiment, not a claim that quality
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
