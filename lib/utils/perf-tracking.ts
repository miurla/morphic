/**
 * Performance tracking utilities for DEVELOPMENT ONLY
 * 
 * WARNING: These global counters are not thread-safe and should only be used
 * for debugging in development environments with ENABLE_PERF_LOGGING=true.
 * 
 * In production, these counters are not used as performance logging is disabled.
 * The global state will cause issues with concurrent requests, but this is
 * acceptable for local development debugging.
 * 
 * DO NOT use these counters for any production logic or metrics.
 */

let authCallCount = 0
let dbOperationCount = 0

export function resetAuthCallCount() {
  authCallCount = 0
}

export function incrementAuthCallCount() {
  authCallCount++
  return authCallCount
}

export function resetDbOperationCount() {
  dbOperationCount = 0
}

export function incrementDbOperationCount() {
  dbOperationCount++
  return dbOperationCount
}

export function resetAllCounters() {
  authCallCount = 0
  dbOperationCount = 0
}
