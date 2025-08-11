// Performance logging utilities

const isPerfLoggingEnabled = process.env.ENABLE_PERF_LOGGING === 'true'

export function perfLog(message: string) {
  if (isPerfLoggingEnabled) {
    console.log(`[PERF] ${message}`)
  }
}

export function perfTime(label: string, startTime: number) {
  if (isPerfLoggingEnabled) {
    console.log(`[PERF] ${label}: ${(performance.now() - startTime).toFixed(2)}ms`)
  }
}