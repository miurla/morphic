ARG BUN_VERSION="1.1"

FROM oven/bun:${BUN_VERSION}-alpine AS base

FROM base AS builder

ENV \
    DOCKER="true" \
    NODE_ENV="production"

WORKDIR /app

COPY package.json bun.lockb ./

RUN bun install

COPY . .

RUN bun next build

FROM scratch AS app

WORKDIR /app

COPY --from=builder /app/public /app/public
COPY --from=builder /app/.next/standalone /app/
COPY --from=builder /app/.next/static /app/.next/static

FROM base

COPY --from=app /app /app

ENV \
    HOSTNAME="0.0.0.0" \
    PORT="3000"

EXPOSE 3000/tcp

CMD ["bun", "/app/server.js"]
