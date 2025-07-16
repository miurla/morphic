FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install PostgreSQL client tools
RUN apt-get update && apt-get install -y \
    postgresql-client \
    redis-tools \
    && rm -rf /var/lib/apt/lists/*

# Install global npm packages
RUN npm install -g prisma

USER node
