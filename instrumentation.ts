import { registerOTel } from '@vercel/otel'
import { LangfuseExporter } from 'langfuse-vercel'

export function register() {
  registerOTel({
    serviceName: 'morphic-ai-search',
    traceExporter: new LangfuseExporter()
  })
}