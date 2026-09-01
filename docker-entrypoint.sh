#!/bin/sh
set -e

if [ -n "${DATABASE_URL:-}" ] || [ -n "${DATABASE_RESTRICTED_URL:-}" ]; then
  echo "Running database migrations..."
  bun run migrate
  echo "Migrations completed. Starting server..."
else
  echo "Database is not configured. Skipping migrations."
fi

exec "$@"
