ARG MODEL_SOURCE=download
ARG RERANK_SERVER_IMAGE=ghcr.io/ggml-org/llama.cpp:server@sha256:b0cd5490eefff30b40dcd47f7249a7d7211136908f73fe440a2a86b35a22b23b

FROM scratch AS download
ADD --checksum=sha256:a43c7c9b11a4c1517e5bf95151960e1621d1b72f7a493364b01e386cf1aaa1d3 \
    https://huggingface.co/gpustack/bge-reranker-v2-m3-GGUF/resolve/3093af03b1a635e67b084b1d8c03c5f5e020fd05/bge-reranker-v2-m3-Q8_0.gguf \
    /bge-reranker-v2-m3-Q8_0.gguf

FROM ${MODEL_SOURCE} AS model-source

FROM ${RERANK_SERVER_IMAGE}
COPY --from=model-source /bge-reranker-v2-m3-Q8_0.gguf /models/bge-reranker-v2-m3-Q8_0.gguf
RUN echo 'a43c7c9b11a4c1517e5bf95151960e1621d1b72f7a493364b01e386cf1aaa1d3  /models/bge-reranker-v2-m3-Q8_0.gguf' | sha256sum -c -
COPY LICENSE /usr/share/licenses/tutor-reranker/LICENSE
LABEL org.opencontainers.image.title="Tutor BGE reranker service" \
      io.morphic.reranker.model="BAAI/bge-reranker-v2-m3" \
      io.morphic.reranker.quantization="Q8_0"
