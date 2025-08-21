import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as relations from './relations'
import * as schema from './schema'

// For server-side usage only
// Use restricted user for application if available, otherwise fall back to regular user
const isDevelopment = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'

if (
  !process.env.DATABASE_URL &&
  !process.env.DATABASE_RESTRICTED_URL &&
  !isTest
) {
  throw new Error(
    'DATABASE_URL or DATABASE_RESTRICTED_URL environment variable is not set'
  )
}

// Connection with connection pooling for server environments
// Prefer restricted user for application runtime
const connectionString =
  process.env.DATABASE_RESTRICTED_URL ?? // Prefer restricted user
  process.env.DATABASE_URL ??
  (isTest ? 'postgres://user:pass@localhost:5432/testdb' : undefined)

if (!connectionString) {
  throw new Error(
    'DATABASE_URL or DATABASE_RESTRICTED_URL environment variable is not set'
  )
}

// Log which connection is being used (for debugging)
if (isDevelopment) {
  console.log(
    '[DB] Using connection:',
    process.env.DATABASE_RESTRICTED_URL
      ? 'Restricted User (RLS Active)'
      : 'Owner User (RLS Bypassed)'
  )
}
const client = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  prepare: false,
  max: 20 // Max 20 connections
})

export const db = drizzle(client, {
  schema: { ...schema, ...relations }
})

// Helper type for all tables
export type Schema = typeof schema
