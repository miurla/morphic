# Isolated Tutor integration smoke

These scripts exercise the real Next routes, PDF parser, PostgreSQL/pgvector,
Redis queue, worker, grading persistence, and browser UI. The AI provider is an
explicit **deterministic test double**. Passing these checks does not establish
retrieval relevance, teaching quality, or grading accuracy with a real model.

Requirements: dependencies installed, local Microsoft Edge, and the isolated
test database/Redis from the Tutor test Compose with the complete app schema.
The scripts use only PostgreSQL `127.0.0.1:15433/tutor_test` and Redis
`127.0.0.1:16380`; they never start, migrate, or stop Docker services.

From the repository root:

```sh
node scripts/tutor-smoke/start.mjs --isolated-local
```

This supervisor starts the test provider on **127.0.0.1:3106**, Next on
**127.0.0.1:3002**, and the worker with explicitly overridden test credentials,
anonymous test identity, local file storage, and the queue on the isolated Redis.
It does not modify `.env` files. Leave it running while, in another terminal:

```sh
node scripts/tutor-smoke/api.mjs
node scripts/tutor-smoke/browser.mjs
node scripts/tutor-smoke/deletion.mjs
```

API assertions include real PDF upload, generation, citation bounds, private
answer exclusion, deterministic grading, idempotent retries, latest-attempt
mastery, and durable reload. Browser assertions use real app requests in English
and Chinese at desktop and 375px widths, including upload, study, PDF highlights,
draft recovery, and feedback. Unrelated external browser requests are blocked.

The deletion check creates its own courses and deletes only those fixtures. It
checks English/Chinese confirmation, keyboard focus, 375px/desktop layouts,
pending/retry behavior, durable deletion, and preservation of shared materials.
Deletion uses the real API; permission/network failures and partial/empty lists
are explicitly injected in the browser. Screenshots and the check report are
saved in `.tmp/tutor-deletion/`. Existing test courses are preserved.

Results, fixture PDF, screenshots, and service logs are written to
`.tmp/tutor-smoke/`; uploaded test files stay in `.tmp/tutor-smoke-files/`.
Runs append test courses so existing test artifacts remain inspectable.
**Ctrl+C in the supervisor terminal stops only its provider and child processes.**
No production model evaluation uses this provider or these synthetic scores.
