import { LangfuseSpanProcessor } from '@langfuse/otel'
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk'
import { registerOTel } from '@vercel/otel'
import { registerTelemetry } from 'ai'

export type Tracing = {
  flush: () => Promise<void>
}

/**
 * Bootstrap the same span pipeline the app uses, outside Next.js.
 *
 * Credentials are required rather than optional: the experiment runner uploads
 * item scores through the Langfuse client whether or not spans are exported, so
 * a keyless run fails partway instead of degrading to a local-only run.
 */
export function setupTracing(): Tracing {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    throw new Error(
      'LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are required. ' +
        'Set them in .env.local (see .env.local.example) or in the CI secrets.'
    )
  }

  const processor = new LangfuseSpanProcessor()
  registerOTel({
    serviceName: 'morphic-evals',
    spanProcessors: [processor]
  })
  registerTelemetry(new LangfuseVercelAiSdkIntegration())

  return { flush: () => processor.forceFlush() }
}
