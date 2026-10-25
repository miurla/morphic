import '@testing-library/jest-dom'

// Provide dummy values for environment variables required during tests
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://user:pass@localhost:5432/testdb'
