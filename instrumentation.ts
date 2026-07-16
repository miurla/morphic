import { LangfuseSpanProcessor } from '@langfuse/otel'
import { registerOTel } from '@vercel/otel'

// Exported so request handlers can force-flush pending spans before the
// serverless function exits
export const langfuseSpanProcessor = new LangfuseSpanProcessor()

export async function register() {
  registerOTel({
    serviceName: 'morphic-ai-search',
    spanProcessors: [langfuseSpanProcessor]
  })

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
