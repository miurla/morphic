
FROM oven/bun:1.1.3-alpine

RUN apk add --no-cache nodejs npm git

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . .

RUN bun next telemetry disable

CMD ["bun", "dev", "-H", "0.0.0.0"]
