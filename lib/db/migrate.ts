import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import 'dotenv/config'

// This script is used to run migrations on the database
// Run it with: bun run lib/db/migrate.ts

const runMigrations = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not defined in environment variables')
    process.exit(1)
  }

  const connectionString = process.env.DATABASE_URL

  // Respect DATABASE_SSL_DISABLED flag (used in Docker)
  // For cloud databases (Supabase, Neon, etc.), use SSL with certificate
  // verification unless explicitly disabled. The connection string's
  // `sslmode=require` must not be contradicted by a client-side `ssl: false`,
  // otherwise the server rejects the connection as insecure.
  const sslDisabled = process.env.DATABASE_SSL_DISABLED === 'true'

  const sql = postgres(connectionString, {
    ssl: sslDisabled ? false : { rejectUnauthorized: true },
    prepare: false
  })

  const db = drizzle(sql)

  console.log('Running migrations...')

  try {
    await migrate(db, { migrationsFolder: 'drizzle' })
    console.log('Migrations completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }

  await sql.end()
  process.exit(0)
}

runMigrations()
