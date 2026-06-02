import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isCloudDeployment } from '@/lib/config/load-models-config'
import { MODEL_SELECTION_COOKIE } from '@/lib/config/model-selection-cookie'
import type { Model } from '@/lib/types/models'
import type { SearchMode } from '@/lib/types/search'

vi.mock('@/lib/config/load-models-config')
vi.mock('@/lib/config/model-types')
vi.mock('@/lib/models/fetch-models')
vi.mock('@/lib/utils/registry')

import { getModelForMode } from '@/lib/config/model-types'
import { fetchAvailableModels } from '@/lib/models/fetch-models'
import { DEFAULT_MODEL, selectModel } from '@/lib/utils/model-selection'
import { isProviderEnabled } from '@/lib/utils/registry'

const mockIsCloudDeployment = vi.mocked(isCloudDeployment)
const mockGetModelForMode = vi.mocked(getModelForMode)
const mockFetchAvailableModels = vi.mocked(fetchAvailableModels)
const mockIsProviderEnabled = vi.mocked(isProviderEnabled)

type Matrix = Partial<Record<SearchMode, Model>>

const quickModel: Model = {
  id: 'quick',
  name: 'Quick',
  provider: 'Provider A',
  providerId: 'provider-a'
}

const adaptiveModel: Model = {
  id: 'adaptive',
  name: 'Adaptive',
  provider: 'Provider B',
  providerId: 'provider-b'
}

let matrix: Matrix

function setMatrixImplementation() {
  mockGetModelForMode.mockImplementation((mode: SearchMode) => matrix[mode])
}

function createCookieStore(value?: string) {
  return {
    get: (name: string) => {
      if (name === MODEL_SELECTION_COOKIE && value) {
        return { name, value } as { name: string; value: string }
      }

      return undefined
    }
  } as any
}

describe('selectModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloudDeployment.mockReturnValue(true)
    matrix = {
      quick: quickModel,
      adaptive: adaptiveModel
    }
    setMatrixImplementation()
    mockIsProviderEnabled.mockReturnValue(true)
    mockFetchAvailableModels.mockResolvedValue({})
  })

  it('returns the cloud model for the active mode when available', async () => {
    const result = await selectModel({
      searchMode: 'quick',
      cookieStore: createCookieStore()
    })
    expect(result).toEqual(quickModel)
  })

  it('falls back to the next mode when active mode provider is disabled', async () => {
    mockIsProviderEnabled.mockImplementation(providerId =>
      providerId === 'provider-a' ? false : true
    )

    const result = await selectModel({
      searchMode: 'quick',
      cookieStore: createCookieStore()
    })

    expect(result).toEqual(adaptiveModel)
  })

  it('falls back to quick mode when search mode is omitted', async () => {
    const result = await selectModel({ cookieStore: createCookieStore() })
    expect(result).toEqual(quickModel)
  })

  it('falls back to DEFAULT_MODEL when cloud models are unavailable', async () => {
    matrix = {}
    setMatrixImplementation()
    const result = await selectModel({
      searchMode: 'quick',
      cookieStore: createCookieStore()
    })
    expect(result).toEqual(DEFAULT_MODEL)
  })

  it('falls back to DEFAULT_MODEL when configured providers are disabled', async () => {
    mockIsProviderEnabled.mockImplementation(providerId =>
      providerId === 'provider-a' || providerId === 'provider-b' ? false : true
    )

    const result = await selectModel({
      searchMode: 'quick',
      cookieStore: createCookieStore()
    })

    expect(result).toEqual(DEFAULT_MODEL)
  })

  it('returns cookie-selected model in local/docker mode', async () => {
    mockIsCloudDeployment.mockReturnValue(false)
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'provider-l'
    )
    mockFetchAvailableModels.mockResolvedValue({
      'Provider L': [
        {
          id: 'local-model',
          name: 'Local Model',
          provider: 'Provider L',
          providerId: 'provider-l'
        }
      ]
    })

    const result = await selectModel({
      cookieStore: createCookieStore('provider-l:local-model')
    })
    expect(result).toEqual({
      id: 'local-model',
      name: 'Local Model',
      provider: 'Provider L',
      providerId: 'provider-l'
    })
  })

  it('does not trust local cookie models that are no longer available', async () => {
    mockIsCloudDeployment.mockReturnValue(false)
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'provider-l' || providerId === 'provider-f'
    )
    mockFetchAvailableModels.mockResolvedValue({
      'Provider F': [
        {
          id: 'fallback-model',
          name: 'Fallback Model',
          provider: 'Provider F',
          providerId: 'provider-f'
        }
      ]
    })

    const result = await selectModel({
      cookieStore: createCookieStore('provider-l:removed-model')
    })

    expect(result).toEqual({
      id: 'fallback-model',
      name: 'Fallback Model',
      provider: 'Provider F',
      providerId: 'provider-f'
    })
  })

  it('falls back to DEFAULT_MODEL in local/docker mode when cookie is missing', async () => {
    mockIsCloudDeployment.mockReturnValue(false)

    const result = await selectModel({ cookieStore: createCookieStore() })
    expect(result).toEqual(DEFAULT_MODEL)
  })

  it('falls back to DEFAULT_MODEL when local cookie provider is disabled', async () => {
    mockIsCloudDeployment.mockReturnValue(false)
    mockIsProviderEnabled.mockImplementation(providerId =>
      providerId === 'provider-l' ? false : true
    )

    const result = await selectModel({
      cookieStore: createCookieStore('provider-l:local-model')
    })
    expect(result).toEqual(DEFAULT_MODEL)
  })

  it('falls back to a compatible NVIDIA model when the local cookie model cannot use search', async () => {
    mockIsCloudDeployment.mockReturnValue(false)
    mockIsProviderEnabled.mockImplementation(providerId =>
      providerId === 'nvidia' || providerId === DEFAULT_MODEL.providerId
        ? true
        : false
    )
    mockFetchAvailableModels.mockResolvedValue({
      'NVIDIA NIM': [
        {
          id: 'microsoft/phi-4-multimodal-instruct',
          name: 'Phi 4 Multimodal Instruct',
          provider: 'NVIDIA NIM',
          providerId: 'nvidia'
        },
        {
          id: 'meta/llama-3.1-70b-instruct',
          name: 'Llama 3.1 70b Instruct',
          provider: 'NVIDIA NIM',
          providerId: 'nvidia'
        },
        {
          id: 'meta/llama-3.1-8b-instruct',
          name: 'Llama 3.1 8b Instruct',
          provider: 'NVIDIA NIM',
          providerId: 'nvidia'
        }
      ]
    })

    const result = await selectModel({
      cookieStore: createCookieStore(
        'nvidia:microsoft/phi-4-multimodal-instruct'
      )
    })

    expect(result).toEqual({
      id: 'meta/llama-3.1-8b-instruct',
      name: 'Llama 3.1 8b Instruct',
      provider: 'NVIDIA NIM',
      providerId: 'nvidia'
    })
  })

  it('sets ollama think provider options for thinking models from cookie', async () => {
    mockIsCloudDeployment.mockReturnValue(false)
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'ollama'
    )
    mockFetchAvailableModels.mockResolvedValue({
      Ollama: [
        {
          id: 'deepseek-r1:8b',
          name: 'deepseek-r1:8b',
          provider: 'Ollama',
          providerId: 'ollama',
          providerOptions: {
            ollama: {
              think: true
            }
          }
        }
      ]
    })

    const result = await selectModel({
      cookieStore: createCookieStore('ollama:deepseek-r1:8b')
    })

    expect(result).toEqual({
      id: 'deepseek-r1:8b',
      name: 'deepseek-r1:8b',
      provider: 'Ollama',
      providerId: 'ollama',
      providerOptions: {
        ollama: {
          think: true
        }
      }
    })
  })

  it('sets ollama think provider options for non-thinking models from cookie', async () => {
    mockIsCloudDeployment.mockReturnValue(false)
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'ollama'
    )
    mockFetchAvailableModels.mockResolvedValue({
      Ollama: [
        {
          id: 'llama3.2:3b',
          name: 'llama3.2:3b',
          provider: 'Ollama',
          providerId: 'ollama',
          providerOptions: {
            ollama: {
              think: true
            }
          }
        }
      ]
    })

    const result = await selectModel({
      cookieStore: createCookieStore('ollama:llama3.2:3b')
    })

    expect(result).toEqual({
      id: 'llama3.2:3b',
      name: 'llama3.2:3b',
      provider: 'Ollama',
      providerId: 'ollama',
      providerOptions: {
        ollama: {
          think: true
        }
      }
    })
  })
})
