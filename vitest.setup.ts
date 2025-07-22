import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Provide dummy values for environment variables required during tests
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://user:pass@localhost:5432/testdb'

// Mock Next.js functions
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn(fn => fn)
}))
