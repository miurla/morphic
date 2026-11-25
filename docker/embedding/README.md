# Tutor embedding image

This image contains Ollama and the official BGE-M3 F16 model (1024 dimensions).
The default build downloads the model automatically and verifies its SHA-256.
Starting a container requires no `ollama pull` or external embedding account.

From the repository root, using Docker BuildKit / Buildx:

```sh
docker buildx build --load -t tutor-embedding:bge-m3 docker/embedding
```

Use the dedicated `docker/embedding` build context; application files and API
keys are not needed. The approximately 1.16 GB model download and the pinned
Ollama base are cached by Docker between builds. An NVIDIA GPU is needed only
at runtime when GPU inference is requested; model import runs without one.

To reuse the exact previously downloaded GGUF without downloading it again:

```sh
docker buildx build --load -t tutor-embedding:bge-m3 --build-context local-model=.tmp/local-bge/model-import --build-arg MODEL_SOURCE=local-model docker/embedding
```

That context must contain `bge-m3.gguf`. The import script verifies the same
pinned model checksum for both source paths. A different model or quantization
is rejected. The unused download stage is skipped by BuildKit.

For a local NVIDIA GPU test:

```sh
docker run -d --name tutor-embedding --gpus all -p 127.0.0.1:11435:11434 tutor-embedding:bge-m3
docker exec tutor-embedding ollama show bge-m3
```

Without an NVIDIA GPU, omit `--gpus all` to use CPU inference. The health check
requires both a running Ollama API and an installed `bge-m3` model; it does not
measure inference speed or retrieval quality. Tutor can use the OpenAI-compatible
base URL `http://127.0.0.1:11435/v1` from the host, model `bge-m3`, dimension `1024`,
and `TUTOR_EMBEDDING_SEND_DIMENSIONS=false`. Set `TUTOR_EMBEDDING_AUTH=none`:
no API key or placeholder is needed, and Tutor sends no Authorization header.
An explicit `TUTOR_EMBEDDING_BASE_URL` is required in this mode. Containers
sharing a Docker network should use the embedding service name and port `11434`
instead.

The final image stores its model cache at `/opt/tutor-models`. Avoid mounting a
volume there: a reused volume can hide updated model files from a newer image.
A new empty named volume may initially receive Docker's copy of the image
contents, but it will not automatically receive later image updates. Keep
`OLLAMA_MODELS=/opt/tutor-models`; existing `/root/.ollama` volumes do not hide
this cache. Cloud features are disabled with `OLLAMA_NO_CLOUD=1`.

The import step runs with networking disabled. Only the resulting model cache
and license files are copied into the final stage. The source GGUF, temporary
import files, build logs and the builder's generated Ollama private key are not
copied. Docker may retain intermediate build cache locally; it is not part of
the final image.

The runtime base image and GGUF content are pinned in the Dockerfile. Model
and license attribution is recorded in [LICENSE-SOURCES.txt](LICENSE-SOURCES.txt).
