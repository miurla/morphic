import { LangfuseSpanProcessor } from '@langfuse/otel'
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk'
import { registerOTel } from '@vercel/otel'
import { registerTelemetry } from 'ai'

import { isTracingEnabled } from '@/lib/utils/telemetry'

// Exported so request handlers can force-flush pending spans before the
// serverless function exits
export const langfuseSpanProcessor = new LangfuseSpanProcessor()

// registerTelemetry appends without deduping, so a second register() would
// double every span.
let telemetryRegistered = false

export async function register() {
  registerOTel({
    serviceName: 'morphic-ai-search',
    spanProcessors: [langfuseSpanProcessor]
  })

  // The AI SDK emits no spans until a telemetry integration is registered.
  // The integration creates the spans, the processor above exports them.
  if (isTracingEnabled() && !telemetryRegistered) {
    registerTelemetry(new LangfuseVercelAiSdkIntegration())
    telemetryRegistered = true
  }

  // Initialize Ollama validation on server startup (only when configured)
  if (process.env.OLLAMA_BASE_URL) {
    const { initializeOllamaValidation } = await import(
      '@/lib/config/ollama-validator'
    )
    await initializeOllamaValidation().catch(err => {
      console.error('Failed to initialize Ollama validation:', err)
    })
  }
}
