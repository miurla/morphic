/**
 * Check if Langfuse tracing is enabled
 * Default: false
 */
export function isTracingEnabled(): boolean {
  return process.env.ENABLE_LANGFUSE_TRACING === 'true'
}
