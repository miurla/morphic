# Build stage - Use Node for Next.js 16 compatibility (Bun lacks worker_threads support on arm64)
ARG NODE_IMAGE=node:22-slim
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

# Install bun for dependency management
RUN if ! command -v bun >/dev/null 2>&1; then npm install -g bun; fi

# Install dependencies (separated for better cache utilization)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code and build
COPY . .
# Only public browser settings are allowed into the build. Secrets are supplied
# to running containers via env_file, never copied from .env.local.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
RUN npx next telemetry disable
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/db
ENV DATABASE_RESTRICTED_URL=postgresql://user:pass@localhost:5432/db
RUN npm run build

# Runtime stage
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

# Install method shown in the sidebar version footer
ENV MORPHIC_INSTALL_METHOD=docker

# Install bun for dependency management (used for migrations)
RUN if ! command -v bun >/dev/null 2>&1; then npm install -g bun; fi

# Copy only necessary files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/node_modules ./node_modules

# Copy migration files and scripts
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy entrypoint script for database migration
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Start production server with migration
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npx", "next", "start", "-H", "0.0.0.0"]
