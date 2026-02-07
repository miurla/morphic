import * as dotenv from 'dotenv'
import { defineConfig } from 'drizzle-kit'

import 'dotenv/config'

// Load from .env.local if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '.env.local' })
}

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
})
