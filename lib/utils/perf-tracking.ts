// Performance tracking utilities (not server actions)

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
