import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ai-sdk/gateway', () => ({
  createGateway: vi.fn()
}))

vi.mock('@/lib/utils/registry', () => ({
  isProviderEnabled: vi.fn()
}))

import { createGateway } from '@ai-sdk/gateway'

import * as fetchModels from '@/lib/models/fetch-models'
import { isProviderEnabled } from '@/lib/utils/registry'

const mockCreateGateway = vi.mocked(createGateway)
const mockIsProviderEnabled = vi.mocked(isProviderEnabled)

describe('fetch-models', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete process.env.OLLAMA_BASE_URL
    delete process.env.OLLAMA_API_KEY
    delete process.env.OLLAMA_CLOUD_BASE_URL
    delete process.env.OLLAMA_CLOUD_MODELS
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    delete process.env.CLOUDFLARE_API_TOKEN
    delete process.env.NVIDIA_API_KEY
    delete process.env.NVIDIA_API_BASE_URL
    delete process.env.NVIDIA_MODELS
    delete process.env.OPENROUTER_SERVER_TOOLS_ENABLED
    delete process.env.OPENROUTER_SERVER_TOOLS
    delete process.env.OPENROUTER_FUSION_ANALYSIS_MODELS
    delete process.env.OPENROUTER_FUSION_JUDGE_MODEL
    delete process.env.OPENROUTER_ADVISOR_MODEL
    delete process.env.OPENROUTER_ADVISOR_TOOLS
  })

  it('filters non-chat and snapshot OpenAI models', async () => {
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'openai'
    )

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        data: [
          { id: 'gpt-5-mini' },
          { id: 'gpt-4o' },
          { id: 'gpt-5-2025-08-07' },
          { id: 'gpt-5-chat-latest' },
          { id: 'gpt-4-turbo' },
          { id: 'text-embedding-3-large' },
          { id: 'o3-mini' },
          { id: 'whisper-1' },
          { id: 'dall-e-3' }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const models = await fetchModels.fetchOpenAIModels()
    expect(models.map(model => model.id)).toEqual(['gpt-5-mini', 'o3-mini'])
  })

  it('groups models by provider and caches results', async () => {
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'openai' || providerId === 'anthropic'
    )

    const fetchMock = vi.fn((url: string) => {
      if (url.includes('api.openai.com/v1/models')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            data: [{ id: 'gpt-5-mini' }]
          })
        })
      }

      if (url.includes('api.anthropic.com/v1/models')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            data: [
              { id: 'claude-sonnet-4', display_name: 'Claude Sonnet 4' },
              { id: 'claude-3-5-sonnet', display_name: 'Claude 3.5 Sonnet' }
            ],
            has_more: false
          })
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const grouped = await fetchModels.fetchAvailableModels({
      forceRefresh: true
    })
    expect(Object.keys(grouped).sort()).toEqual(['Anthropic', 'OpenAI'])
    expect(grouped.OpenAI?.[0]?.id).toBe('gpt-5-mini')
    expect(grouped.Anthropic?.[0]?.id).toBe('claude-sonnet-4')

    await fetchModels.fetchAvailableModels()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('normalizes gateway models with providerId as gateway', async () => {
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'gateway'
    )

    const getAvailableModels = vi.fn().mockResolvedValue({
      models: [
        {
          id: 'openai/gpt-5-mini',
          name: 'GPT-5 Mini',
          modelType: 'language'
        },
        {
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          modelType: 'language'
        },
        {
          id: 'openai/gpt-5-2025-08-07',
          name: 'GPT-5 Snapshot',
          modelType: 'language'
        },
        {
          id: 'google/gemini-2.0-flash',
          name: 'Gemini 2.0 Flash',
          modelType: 'language'
        },
        {
          id: 'openai/text-embedding-3-small',
          name: 'text-embedding-3-small',
          modelType: 'embedding'
        }
      ]
    })
    mockCreateGateway.mockReturnValue({
      getAvailableModels
    } as any)

    const models = await fetchModels.fetchGatewayModels()
    expect(models).toEqual([
      {
        id: 'openai/gpt-5-mini',
        name: 'GPT-5 Mini',
        provider: 'Gateway',
        providerId: 'gateway'
      }
    ])
  })

  it('filters google models to active gemini chat models', async () => {
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'google'
    )

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        models: [
          {
            name: 'models/gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            supportedGenerationMethods: ['generateContent']
          },
          {
            name: 'models/gemini-2.5-pro-preview-09-2025',
            displayName: 'Gemini 2.5 Pro Preview',
            supportedGenerationMethods: ['generateContent']
          },
          {
            name: 'models/gemini-2.5-flash-image',
            displayName: 'Gemini 2.5 Flash Image',
            supportedGenerationMethods: ['generateContent']
          },
          {
            name: 'models/gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            supportedGenerationMethods: ['generateContent']
          }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const models = await fetchModels.fetchGoogleModels()
    expect(models.map(model => model.id)).toEqual(['gemini-2.5-pro'])
  })

  it('fetches Cloudflare Workers AI models from the model search endpoint', async () => {
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'cloudflare'
    )
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-id'
    process.env.CLOUDFLARE_API_TOKEN = 'cloudflare-token'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        result: {
          data: [
            { id: '@cf/meta/llama-3.3-70b-instruct' },
            { id: '@cf/baai/bge-base-en-v1.5' },
            { id: '@cf/qwen/qwen3-30b-a3b-fp8' }
          ]
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const models = await fetchModels.fetchCloudflareModels()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-id/ai/models/search',
      expect.objectContaining({
        headers: { Authorization: 'Bearer cloudflare-token' },
        method: 'GET'
      })
    )
    expect(models).toEqual([
      {
        id: '@cf/meta/llama-3.3-70b-instruct',
        name: 'llama-3.3-70b-instruct',
        provider: 'Cloudflare',
        providerId: 'cloudflare'
      },
      {
        id: '@cf/qwen/qwen3-30b-a3b-fp8',
        name: 'qwen3-30b-a3b-fp8',
        provider: 'Cloudflare',
        providerId: 'cloudflare'
      }
    ])
  })

  it('falls back quietly when Cloudflare model discovery returns a client error', async () => {
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'cloudflare'
    )
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-id'
    process.env.CLOUDFLARE_API_TOKEN = 'cloudflare-token'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 405,
      statusText: 'Method Not Allowed'
    })
    vi.stubGlobal('fetch', fetchMock)
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const models = await fetchModels.fetchCloudflareModels()

    expect(models.map(model => model.id)).toEqual([
      '@cf/meta/llama-3.3-70b-instruct',
      '@cf/meta/llama-3.1-8b-instruct',
      '@cf/meta/llama-3.2-3b-instruct',
      '@cf/qwen/qwen1.5-14b-chat-awq'
    ])
    expect(infoSpy).toHaveBeenCalledWith(
      '[ModelFetch] Cloudflare model discovery unavailable (HTTP 405: Method Not Allowed); using fallback models.'
    )
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('adds think provider options for ollama thinking models', async () => {
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'ollama'
    )
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        models: [{ name: 'deepseek-r1:8b' }, { name: 'llama3.2:3b' }]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const models = await fetchModels.fetchOllamaModels()
    expect(models).toEqual([
      {
        id: 'deepseek-r1:8b',
        name: 'deepseek-r1:8b',
        provider: 'Ollama',
        providerId: 'ollama',
        capabilities: [
          'chat',
          'streaming',
          'toolCalling',
          'thinking',
          'structuredOutputs'
        ],
        providerOptions: {
          ollama: {
            think: true
          }
        }
      },
      {
        id: 'llama3.2:3b',
        name: 'llama3.2:3b',
        provider: 'Ollama',
        providerId: 'ollama',
        capabilities: ['chat', 'streaming', 'toolCalling', 'structuredOutputs']
      }
    ])
  })

  describe('fetchOllamaCloudModels', () => {
    it('returns empty list when Ollama Cloud is not enabled', async () => {
      mockIsProviderEnabled.mockImplementation(() => false)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOllamaCloudModels()

      expect(models).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('fetches Ollama Cloud models from ollama.com with bearer auth', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'ollama-cloud'
      )
      process.env.OLLAMA_API_KEY = 'ollama-cloud-key'

      const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
        if (url === 'https://ollama.com/api/tags') {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
              models: [
                { name: 'gpt-oss:120b' },
                { name: 'nomic-embed-text' },
                { name: 'qwen3-vl:235b' },
                { name: 'gemma4:31b' }
              ]
            })
          }
        }

        if (url === 'https://ollama.com/api/show') {
          const body = JSON.parse(String(options?.body ?? '{}'))
          const capabilitiesByModel: Record<string, string[]> = {
            'gpt-oss:120b': ['completion', 'tools', 'thinking'],
            'nomic-embed-text': ['embedding'],
            'qwen3-vl:235b': ['completion', 'tools', 'thinking', 'vision'],
            'gemma4:31b': ['completion', 'vision']
          }
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
              capabilities: capabilitiesByModel[String(body.model)] ?? []
            })
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      })
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOllamaCloudModels()

      expect(fetchMock).toHaveBeenCalledWith(
        'https://ollama.com/api/tags',
        expect.objectContaining({
          headers: { Authorization: 'Bearer ollama-cloud-key' },
          method: 'GET'
        })
      )
      expect(models).toEqual([
        {
          id: 'gpt-oss:120b',
          name: 'gpt-oss:120b',
          provider: 'Ollama Cloud',
          providerId: 'ollama-cloud',
          capabilities: [
            'chat',
            'streaming',
            'toolCalling',
            'thinking',
            'webSearch'
          ],
          providerOptions: {
            ollama: {
              think: 'medium'
            }
          }
        },
        {
          id: 'qwen3-vl:235b',
          name: 'qwen3-vl:235b',
          provider: 'Ollama Cloud',
          providerId: 'ollama-cloud',
          capabilities: [
            'chat',
            'streaming',
            'toolCalling',
            'thinking',
            'vision',
            'webSearch'
          ],
          providerOptions: {
            ollama: {
              think: true
            }
          }
        }
      ])
    })

    it('uses OLLAMA_CLOUD_MODELS static list when configured', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'ollama-cloud'
      )
      process.env.OLLAMA_API_KEY = 'ollama-cloud-key'
      process.env.OLLAMA_CLOUD_MODELS =
        'qwen3:235b,nomic-embed-text,gpt-oss:120b'

      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOllamaCloudModels()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(models.map(model => model.id)).toEqual([
        'gpt-oss:120b',
        'qwen3:235b'
      ])
    })
  })

  describe('fetchOpenAICompatibleModels', () => {
    afterEach(() => {
      delete process.env.OPENAI_COMPATIBLE_API_BASE_URL
      delete process.env.OPENAI_COMPATIBLE_API_KEY
      delete process.env.OPENAI_COMPATIBLE_PROVIDER_NAME
      delete process.env.OPENAI_COMPATIBLE_MODELS
    })

    it('fetches /v1/models and filters embeddings + audio', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'openai-compatible'
      )
      process.env.OPENAI_COMPATIBLE_API_BASE_URL = 'https://api.deepseek.com'
      process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key'
      process.env.OPENAI_COMPATIBLE_PROVIDER_NAME = 'DeepSeek'

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [
            { id: 'deepseek-chat' },
            { id: 'deepseek-reasoner' },
            { id: 'text-embedding-3-small' },
            { id: 'whisper-1' }
          ]
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOpenAICompatibleModels()
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/models',
        expect.objectContaining({ method: 'GET' })
      )
      expect(models.map(m => m.id)).toEqual([
        'deepseek-chat',
        'deepseek-reasoner'
      ])
      expect(models[0]).toMatchObject({
        provider: 'DeepSeek',
        providerId: 'openai-compatible'
      })
    })

    it('strips trailing /v1 from base URL before appending /v1/models', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'openai-compatible'
      )
      process.env.OPENAI_COMPATIBLE_API_BASE_URL = 'https://api.example.com/v1/'
      process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key'

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [{ id: 'foo-1' }] })
      })
      vi.stubGlobal('fetch', fetchMock)

      await fetchModels.fetchOpenAICompatibleModels()
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/v1/models',
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('falls back to "OpenAI Compatible" provider name when env not set', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'openai-compatible'
      )
      process.env.OPENAI_COMPATIBLE_API_BASE_URL = 'https://api.deepseek.com'
      process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key'

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [{ id: 'deepseek-chat' }] })
      })
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOpenAICompatibleModels()
      expect(models[0]?.provider).toBe('OpenAI Compatible')
    })

    it('returns empty list when provider not enabled', async () => {
      mockIsProviderEnabled.mockImplementation(() => false)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOpenAICompatibleModels()
      expect(models).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('uses OPENAI_COMPATIBLE_MODELS static list when set, skipping fetch', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'openai-compatible'
      )
      process.env.OPENAI_COMPATIBLE_MODELS =
        'deepseek-chat, deepseek-reasoner , '
      process.env.OPENAI_COMPATIBLE_PROVIDER_NAME = 'DeepSeek'

      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOpenAICompatibleModels()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(models.map(m => m.id)).toEqual([
        'deepseek-chat',
        'deepseek-reasoner'
      ])
      expect(models[0]?.provider).toBe('DeepSeek')
    })
  })

  describe('fetchNvidiaModels', () => {
    it('fetches NVIDIA NIM models from the OpenAI-compatible /v1/models endpoint', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'nvidia'
      )
      process.env.NVIDIA_API_KEY = 'nvapi-test'

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [
            { id: 'meta/llama-3.1-8b-instruct' },
            { id: 'nvidia/llama-3.1-nemotron-70b-instruct' },
            { id: 'nvidia/ai-synthetic-video-detector' },
            { id: 'microsoft/phi-4-multimodal-instruct' },
            { id: 'nvidia/nv-embedqa-e5-v5' },
            { id: 'nvidia/rerankqa-mistral-4b-v3' }
          ]
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchNvidiaModels()

      expect(fetchMock).toHaveBeenCalledWith(
        'https://integrate.api.nvidia.com/v1/models',
        expect.objectContaining({
          headers: { Authorization: 'Bearer nvapi-test' },
          method: 'GET'
        })
      )
      expect(models.map(model => model.id)).toEqual([
        'meta/llama-3.1-8b-instruct',
        'nvidia/llama-3.1-nemotron-70b-instruct'
      ])
      expect(models[0]).toMatchObject({
        provider: 'NVIDIA NIM',
        providerId: 'nvidia'
      })
    })

    it('uses NVIDIA_MODELS static list when set', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'nvidia'
      )
      process.env.NVIDIA_API_KEY = 'nvapi-test'
      process.env.NVIDIA_MODELS =
        'meta/llama-3.1-8b-instruct, microsoft/phi-4-multimodal-instruct, nvidia/llama-3.1-nemotron-70b-instruct'

      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchNvidiaModels()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(models.map(model => model.id)).toEqual([
        'meta/llama-3.1-8b-instruct',
        'nvidia/llama-3.1-nemotron-70b-instruct'
      ])
    })
  })

  describe('fetchOpenRouterModels', () => {
    afterEach(() => {
      delete process.env.OPENROUTER_API_KEY
      delete process.env.OPENROUTER_MODELS
    })

    it('returns empty list when provider is not enabled', async () => {
      mockIsProviderEnabled.mockImplementation(() => false)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOpenRouterModels()
      expect(models).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('fetches OpenRouter models, filters non-chat/moderation models, and sorts them', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'openrouter'
      )
      process.env.OPENROUTER_API_KEY = 'or-test-key'

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [
            { id: 'google/gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash' },
            {
              id: 'meta-llama/llama-3.3-70b-instruct',
              name: 'Meta: Llama 3.3 70B Instruct'
            },
            {
              id: 'openai/text-embedding-3-small',
              name: 'OpenAI: Text Embedding'
            },
            {
              id: 'meta-llama/llama-guard-3-8b',
              name: 'Meta: Llama Guard 3 8B (Moderation)'
            }
          ]
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOpenRouterModels()

      expect(fetchMock).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        expect.objectContaining({
          headers: { Authorization: 'Bearer or-test-key' },
          method: 'GET'
        })
      )
      expect(models.map(m => m.id)).toEqual([
        'google/gemini-2.5-flash',
        'meta-llama/llama-3.3-70b-instruct'
      ])
      expect(models[0]).toEqual({
        id: 'google/gemini-2.5-flash',
        name: 'Google: Gemini 2.5 Flash',
        provider: 'OpenRouter',
        providerId: 'openrouter'
      })
    })

    it('falls back to default models if fetch fails', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'openrouter'
      )
      process.env.OPENROUTER_API_KEY = 'or-test-key'

      const fetchMock = vi.fn().mockRejectedValue(new Error('Network failure'))
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOpenRouterModels()
      expect(models.length).toBeGreaterThan(0)
      expect(models[0].providerId).toBe('openrouter')
    })

    it('uses static list when OPENROUTER_MODELS is configured', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'openrouter'
      )
      process.env.OPENROUTER_API_KEY = 'or-test-key'
      process.env.OPENROUTER_MODELS =
        'google/gemini-2.5-flash, deepseek/deepseek-chat'

      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOpenRouterModels()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(models.map(m => m.id)).toEqual([
        'deepseek/deepseek-chat',
        'google/gemini-2.5-flash'
      ])
    })

    it('adds validated OpenRouter beta server-tool provider options from env', async () => {
      mockIsProviderEnabled.mockImplementation(
        providerId => providerId === 'openrouter'
      )
      process.env.OPENROUTER_API_KEY = 'or-test-key'
      process.env.OPENROUTER_MODELS = 'google/gemini-2.5-flash'
      process.env.OPENROUTER_SERVER_TOOLS_ENABLED = 'true'
      process.env.OPENROUTER_SERVER_TOOLS = 'fusion,advisor'
      process.env.OPENROUTER_FUSION_ANALYSIS_MODELS =
        '~google/gemini-flash-latest'
      process.env.OPENROUTER_FUSION_JUDGE_MODEL = '~openai/gpt-latest'
      process.env.OPENROUTER_ADVISOR_MODEL = '~anthropic/claude-opus-latest'
      process.env.OPENROUTER_ADVISOR_TOOLS = 'web_search'

      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const models = await fetchModels.fetchOpenRouterModels()

      expect(models[0].providerOptions).toEqual({
        openrouter: {
          serverTools: {
            enabled: true,
            tools: ['fusion', 'advisor'],
            fusion: {
              analysisModels: ['~google/gemini-flash-latest'],
              model: '~openai/gpt-latest'
            },
            advisor: {
              model: '~anthropic/claude-opus-latest',
              tools: ['web_search']
            }
          }
        }
      })
    })
  })
})
