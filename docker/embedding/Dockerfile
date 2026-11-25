# Uses the Docker Desktop / BuildKit bundled frontend; no frontend image pull.
# Override only to a named build context containing bge-m3.gguf. The import
# script verifies the same digest for downloaded and locally supplied weights.
ARG MODEL_SOURCE=model-download

FROM scratch AS model-download
ADD --checksum=sha256:daec91ffb5dd0c27411bd71f29932917c49cf529a641d0168496c3a501e3062c \
    https://registry.ollama.ai/v2/library/bge-m3/blobs/sha256:daec91ffb5dd0c27411bd71f29932917c49cf529a641d0168496c3a501e3062c \
    /bge-m3.gguf

FROM ${MODEL_SOURCE} AS model-source

FROM ollama/ollama@sha256:1cabd20e1762a7a8444bf4a7110b346d923cd77ab6c97c984434140638c913ec AS model-builder
ENV OLLAMA_MODELS=/opt/tutor-models \
    OLLAMA_HOST=127.0.0.1:11434 \
    OLLAMA_NO_CLOUD=1
COPY --chmod=0755 build-model.sh /usr/local/bin/build-tutor-model
COPY LICENSE.bge-m3 /usr/share/licenses/tutor-embedding/LICENSE.bge-m3
# Mount the GGUF rather than copying it into an image layer. Import is local
# and needs neither network access nor a GPU.
RUN --network=none \
    --mount=type=bind,from=model-source,source=/bge-m3.gguf,target=/tmp/bge-m3.gguf,readonly \
    /bin/bash /usr/local/bin/build-tutor-model

FROM ollama/ollama@sha256:1cabd20e1762a7a8444bf4a7110b346d923cd77ab6c97c984434140638c913ec AS runtime
ENV OLLAMA_MODELS=/opt/tutor-models \
    OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_NO_CLOUD=1
LABEL org.opencontainers.image.title="Tutor BGE-M3 embedding service" \
    io.morphic.embedding.model="bge-m3" \
    io.morphic.embedding.dimensions="1024" \
    io.morphic.embedding.model.sha256="daec91ffb5dd0c27411bd71f29932917c49cf529a641d0168496c3a501e3062c"
# Only the imported model cache crosses stages. The builder's generated
# /root/.ollama identity, logs, Modelfile and source GGUF are not included.
COPY --from=model-builder /opt/tutor-models /opt/tutor-models
COPY LICENSE.bge-m3 LICENSE-SOURCES.txt /usr/share/licenses/tutor-embedding/
EXPOSE 11434
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 \
    CMD OLLAMA_HOST=127.0.0.1:11434 ollama show bge-m3 >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/bin/ollama"]
CMD ["serve"]
