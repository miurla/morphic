const nextJest = require('next/jest')

// Providing the path to your Next.js app to load next.config.js and .env files in your test environment
const createJestConfig = nextJest({
  dir: './'
})

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Use jest-environment-jsdom for simulating DOM environment
  testEnvironment: 'jest-environment-jsdom',

  // Explicitly inject Jest global variables
  injectGlobals: true,

  // Ignore Playwright tests directory
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/tests/e2e/'
  ],

  // Handle module aliases (this will be automatically configured by next/jest)
  // moduleNameMapper: {
  //   '^@/components/(.*)$': '<rootDir>/components/$1',
  //   '^@/lib/(.*)$': '<rootDir>/lib/$1'
  // },

  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  // collectCoverage: true,

  // The directory where Jest should output its coverage files
  // coverageDirectory: "coverage",

  // Indicates which provider should be used to instrument code for coverage
  // coverageProvider: "v8",

  // A preset that is used as a base for Jest's configuration (handles TS via ts-jest)
  preset: 'ts-jest' // Re-enable ts-jest preset explicitly
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
