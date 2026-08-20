import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the modules before any imports
vi.mock('@langfuse/otel', () => ({
  LangfuseSpanProcessor: vi.fn()
}))
vi.mock('@vercel/otel', () => ({
  registerOTel: vi.fn()
}))
vi.mock('@langfuse/vercel-ai-sdk', () => ({
  LangfuseVercelAiSdkIntegration: vi.fn()
}))
vi.mock('ai', async importOriginal => ({
  ...(await importOriginal<typeof import('ai')>()),
  registerTelemetry: vi.fn()
}))

// Import after mocking
import { LangfuseSpanProcessor } from '@langfuse/otel'
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk'
import { registerOTel } from '@vercel/otel'
import { registerTelemetry } from 'ai'

import { langfuseSpanProcessor, register } from './instrumentation'

const originalTracingFlag = process.env.ENABLE_LANGFUSE_TRACING

describe('instrumentation', () => {
  afterEach(() => {
    if (originalTracingFlag === undefined) {
      delete process.env.ENABLE_LANGFUSE_TRACING
    } else {
      process.env.ENABLE_LANGFUSE_TRACING = originalTracingFlag
    }
  })

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

  it('registers the AI SDK telemetry integration once when tracing is enabled', async () => {
    delete process.env.OLLAMA_BASE_URL
    process.env.ENABLE_LANGFUSE_TRACING = 'true'
    vi.mocked(LangfuseVercelAiSdkIntegration).mockClear()
    vi.mocked(registerTelemetry).mockClear()
    vi.resetModules()

    // Fresh module so the registered-once guard starts from its initial state
    const instrumentation = await import('./instrumentation')
    await instrumentation.register()
    await instrumentation.register()

    expect(LangfuseVercelAiSdkIntegration).toHaveBeenCalledTimes(1)
    expect(registerTelemetry).toHaveBeenCalledTimes(1)
  })

  it('skips the telemetry integration when tracing is disabled', async () => {
    delete process.env.OLLAMA_BASE_URL
    delete process.env.ENABLE_LANGFUSE_TRACING
    vi.mocked(registerTelemetry).mockClear()
    vi.resetModules()

    const instrumentation = await import('./instrumentation')
    await instrumentation.register()

    expect(registerTelemetry).not.toHaveBeenCalled()
  })
})
