import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

// Provide dummy env vars at configuration time to avoid import errors during bundling
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://user:pass@localhost:5432/testdb'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts'
  }
})
