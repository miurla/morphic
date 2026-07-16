import { describe, expect, it, vi } from 'vitest'

// Mock the modules before any imports
vi.mock('@langfuse/otel', () => ({
  LangfuseSpanProcessor: vi.fn()
}))
vi.mock('@vercel/otel', () => ({
  registerOTel: vi.fn()
}))

// Import after mocking
import { LangfuseSpanProcessor } from '@langfuse/otel'
import { registerOTel } from '@vercel/otel'

import { langfuseSpanProcessor, register } from './instrumentation'

describe('instrumentation', () => {
  it('exports a shared LangfuseSpanProcessor instance for force-flushing', () => {
    expect(LangfuseSpanProcessor).toHaveBeenCalledTimes(1)
    expect(langfuseSpanProcessor).toBeInstanceOf(LangfuseSpanProcessor)
  })

  it('registers the Langfuse span processor with OTel', async () => {
    delete process.env.OLLAMA_BASE_URL

    await register()

    expect(registerOTel).toHaveBeenCalledWith({
      serviceName: 'morphic-ai-search',
      spanProcessors: [langfuseSpanProcessor]
    })
  })
})
