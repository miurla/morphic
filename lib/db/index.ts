import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// For server-side usage only
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Connection with connection pooling for server environments
const connectionString = process.env.DATABASE_URL
const client = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  prepare: false,
  max: 20 // Max 20 connections
})

export const db = drizzle(client, { schema })

// Helper type for all tables
export type Schema = typeof schema
