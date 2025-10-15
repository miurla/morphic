import { registerOTel } from '@vercel/otel'
import { LangfuseExporter } from 'langfuse-vercel'

export async function register() {
  registerOTel({
    serviceName: 'morphic-ai-search',
    traceExporter: new LangfuseExporter()
  })

  // Initialize Ollama validation on server startup (Node.js only)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeOllamaValidation } = await import(
      '@/lib/config/ollama-validator'
    )
    await initializeOllamaValidation().catch(err => {
      console.error('Failed to initialize Ollama validation:', err)
    })
  }
}
