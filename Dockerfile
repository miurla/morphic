# Base image
FROM oven/bun:1.1.3-alpine AS builder

# Install build tools
RUN apk add --no-cache nodejs npm git

WORKDIR /app

# Install dependencies (separated for better cache utilization)
COPY package.json bun.lockb ./
RUN bun install

# Copy source code and build
COPY . .
RUN bun next telemetry disable
RUN bun run build

# Runtime stage
FROM oven/bun:1.1.3-alpine AS runner
WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lockb ./bun.lockb
COPY --from=builder /app/node_modules ./node_modules

# Start production server
CMD ["bun", "start", "-H", "0.0.0.0"]
