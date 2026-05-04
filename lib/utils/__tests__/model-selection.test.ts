import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isCloudDeployment } from '@/lib/config/load-models-config'
import { MODEL_SELECTION_COOKIE } from '@/lib/config/model-selection-cookie'
import type { Model } from '@/lib/types/models'
import type { SearchMode } from '@/lib/types/search'

vi.mock('@/lib/config/load-models-config')
vi.mock('@/lib/config/model-types')
vi.mock('@/lib/utils/registry')

import { getModelForMode } from '@/lib/config/model-types'
import { DEFAULT_MODEL, selectModel } from '@/lib/utils/model-selection'
import { isProviderEnabled } from '@/lib/utils/registry'

const mockIsCloudDeployment = vi.mocked(isCloudDeployment)
const mockGetModelForMode = vi.mocked(getModelForMode)
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

const deepseekQualityModel = {
  ...DEFAULT_MODEL,
  providerOptions: {
    deepseek: {
      thinking: {
        type: 'enabled'
      },
      reasoning_effort: 'high'
    }
  }
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

  it('falls back to quality mode when search mode is omitted', async () => {
    const result = await selectModel({ cookieStore: createCookieStore() })
    expect(result).toEqual(adaptiveModel)
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

    const result = await selectModel({
      cookieStore: createCookieStore('provider-l:local-model')
    })
    expect(result).toEqual({
      id: 'local-model',
      name: 'local-model',
      provider: 'provider-l',
      providerId: 'provider-l'
    })
  })

  it('falls back to DEFAULT_MODEL in local/docker mode when cookie is missing', async () => {
    mockIsCloudDeployment.mockReturnValue(false)

    const result = await selectModel({ cookieStore: createCookieStore() })
    expect(result).toEqual(deepseekQualityModel)
  })

  it('falls back to DEFAULT_MODEL when local cookie provider is disabled', async () => {
    mockIsCloudDeployment.mockReturnValue(false)
    mockIsProviderEnabled.mockImplementation(providerId =>
      providerId === 'provider-l' ? false : true
    )

    const result = await selectModel({
      cookieStore: createCookieStore('provider-l:local-model')
    })
    expect(result).toEqual(deepseekQualityModel)
  })

  it('sets ollama think provider options for thinking models from cookie', async () => {
    mockIsCloudDeployment.mockReturnValue(false)
    mockIsProviderEnabled.mockImplementation(
      providerId => providerId === 'ollama'
    )

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
