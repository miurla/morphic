# Build stage - Use Node for Next.js 16 compatibility (Bun lacks worker_threads support on arm64)
FROM node:22-slim AS builder

WORKDIR /app

# Install bun for dependency management
RUN npm install -g bun

# Install dependencies (separated for better cache utilization)
COPY package.json bun.lock ./
RUN bun install

# Copy source code and build
COPY . .
RUN npx next telemetry disable
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/db
RUN npm run build

# Runtime stage
FROM node:22-slim AS runner
WORKDIR /app

# Install bun for dependency management (used for migrations)
RUN npm install -g bun

# Copy only necessary files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/node_modules ./node_modules

# Create entrypoint script
RUN echo '#!/bin/sh\nexec "$@"' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Start production server with migration
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npx", "next", "start", "-H", "0.0.0.0"]
