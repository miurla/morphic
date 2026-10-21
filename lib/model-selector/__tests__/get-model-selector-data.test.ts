import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@/lib/models/fetch-models', () => ({ fetchAvailableModels: vi.fn() }))
vi.mock('@/lib/utils/registry', () => ({ isProviderEnabled: vi.fn() }))

import { cookies } from 'next/headers'

import { serializeModelSelectionCookie } from '@/lib/config/model-selection-cookie'
import { fetchAvailableModels } from '@/lib/models/fetch-models'
import { isProviderEnabled } from '@/lib/utils/registry'

import { getModelSelectorData } from '../get-model-selector-data'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('saved MiniMax selection', () => {
  it.each([
    ['gateway', 'Gateway', 'minimax/minimax-m2.7'],
    ['openai-compatible', 'OpenAI Compatible', 'MiniMax-M2.7'],
    ['openai-compatible', 'OpenAI Compatible', 'MiniMax-custom']
  ])(
    'keeps %s:%s:%s visible without mutating cached choices',
    async (providerId, provider, id) => {
      vi.stubEnv('MORPHIC_CLOUD_DEPLOYMENT', 'false')
      const grouped = { [provider]: [] }
      vi.mocked(fetchAvailableModels).mockResolvedValue(grouped)
      vi.mocked(isProviderEnabled).mockImplementation(
        value => value === providerId
      )
      vi.mocked(cookies).mockResolvedValue({
        get: () => ({
          value: serializeModelSelectionCookie({ providerId, modelId: id })
        })
      } as any)
      const result = await getModelSelectorData()
      expect(result.selectedModelKey).toBe(`${providerId}:${id}`)
      expect(result.modelsByProvider[provider][0].id).toBe(id)
      expect(result.hasAvailableModels).toBe(true)
      expect(grouped[provider]).toEqual([])
    }
  )

  it('does not restore a model whose provider is disabled', async () => {
    vi.stubEnv('MORPHIC_CLOUD_DEPLOYMENT', 'false')
    vi.mocked(fetchAvailableModels).mockResolvedValue({})
    vi.mocked(isProviderEnabled).mockReturnValue(false)
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: 'gateway:minimax%2Fminimax-m2.7' })
    } as any)
    expect((await getModelSelectorData()).selectedModelKey).toBe('')
  })
})
