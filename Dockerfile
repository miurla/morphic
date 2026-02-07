# Base image
FROM oven/bun:1.2.12 AS builder

WORKDIR /app

# Install dependencies (separated for better cache utilization)
COPY package.json bun.lock ./
RUN bun install

# Copy source code and build
COPY . .
RUN bun next telemetry disable
RUN bun run build

# Runtime stage
FROM oven/bun:1.2.12 AS runner
WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/node_modules ./node_modules

# Copy migration files and scripts
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/lib/db ./lib/db
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Create entrypoint script for database migration
RUN echo '#!/bin/sh\n\
set -e\n\
echo "Running database migrations..."\n\
bun run migrate\n\
echo "Migrations completed. Starting server..."\n\
exec "$@"\n' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Start production server with migration
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["bun", "start", "-H", "0.0.0.0"]
