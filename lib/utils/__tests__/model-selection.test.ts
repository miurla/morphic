import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModelType } from '@/lib/types/model-type'
import type { Model } from '@/lib/types/models'
import type { SearchMode } from '@/lib/types/search'

vi.mock('@/lib/config/model-types')
vi.mock('@/lib/utils/registry')

import { getModelForModeAndType } from '@/lib/config/model-types'
import { DEFAULT_MODEL, selectModel } from '@/lib/utils/model-selection'
import { isProviderEnabled } from '@/lib/utils/registry'

const mockGetModelForModeAndType = vi.mocked(getModelForModeAndType)
const mockIsProviderEnabled = vi.mocked(isProviderEnabled)

type Matrix = Record<SearchMode, Partial<Record<ModelType, Model>>>

const quickSpeedModel: Model = {
  id: 'quick-speed',
  name: 'Quick Speed',
  provider: 'Provider A',
  providerId: 'provider-a'
}

const quickQualityModel: Model = {
  id: 'quick-quality',
  name: 'Quick Quality',
  provider: 'Provider B',
  providerId: 'provider-b'
}

const adaptiveQualityModel: Model = {
  id: 'adaptive-quality',
  name: 'Adaptive Quality',
  provider: 'Provider C',
  providerId: 'provider-c'
}

const adaptiveSpeedModel: Model = {
  id: 'adaptive-speed',
  name: 'Adaptive Speed',
  provider: 'Provider D',
  providerId: 'provider-d'
}

let matrix: Matrix

function setMatrixImplementation() {
  mockGetModelForModeAndType.mockImplementation(
    (mode: SearchMode, type: ModelType) => matrix[mode]?.[type]
  )
}

function createCookieStore(modelType?: string): ReadonlyRequestCookies {
  return {
    get: (name: string) => {
      if (name === 'modelType' && modelType) {
        return { name, value: modelType } as any
      }
      return undefined
    }
  } as unknown as ReadonlyRequestCookies
}

describe('selectModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrix = {
      quick: {
        speed: quickSpeedModel,
        quality: quickQualityModel
      },
      adaptive: {
        speed: adaptiveSpeedModel,
        quality: adaptiveQualityModel
      }
    }
    setMatrixImplementation()
    mockIsProviderEnabled.mockReturnValue(true)
  })

  it('returns the cookie-preferred type for the active mode when available', () => {
    const result = selectModel({
      cookieStore: createCookieStore('quality'),
      searchMode: 'quick'
    })

    expect(result).toEqual(quickQualityModel)
  })

  it('falls back to speed model for the mode when cookie is absent', () => {
    const result = selectModel({
      cookieStore: createCookieStore(),
      searchMode: 'adaptive'
    })

    expect(result).toEqual(adaptiveSpeedModel)
  })

  it('falls back to the other type within the same mode when preferred provider is disabled', () => {
    mockIsProviderEnabled.mockImplementation(providerId =>
      providerId === 'provider-a' ? false : true
    )

    const result = selectModel({
      cookieStore: createCookieStore('speed'),
      searchMode: 'quick'
    })

    expect(result).toEqual(quickQualityModel)
  })

  it('falls back to the next mode in priority order when active mode has no enabled models', () => {
    mockIsProviderEnabled.mockImplementation(providerId =>
      providerId === 'provider-a' || providerId === 'provider-b' ? false : true
    )

    const result = selectModel({
      cookieStore: createCookieStore('quality'),
      searchMode: 'quick'
    })

    expect(result).toEqual(adaptiveQualityModel)
  })

  it('returns DEFAULT_MODEL when no configured providers are enabled', () => {
    mockIsProviderEnabled.mockReturnValue(false)

    const result = selectModel({
      cookieStore: createCookieStore(),
      searchMode: 'quick'
    })

    expect(result).toEqual(DEFAULT_MODEL)
  })
})
