import { describe, expect, it, vi } from 'vitest'

import { Chat } from '@/components/chat'

import SearchPage from '../page'

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: async () => 'owner'
}))
vi.mock('@/lib/auth/provider', () => ({ isAnonymousMode: () => false }))
vi.mock('@/lib/model-selector/get-model-selector-data', () => ({
  getModelSelectorData: async () => undefined
}))
vi.mock('@/components/chat', () => ({ Chat: () => null }))

describe('query search page', () => {
  it('leaves new chat identity with the client across server refreshes', async () => {
    const first = await SearchPage({
      searchParams: Promise.resolve({ q: 'hello' })
    })
    const refreshed = await SearchPage({
      searchParams: Promise.resolve({ q: 'hello' })
    })
    expect(first.type).toBe(Chat)
    expect(refreshed.type).toBe(Chat)
    expect(first.props).toEqual(refreshed.props)
    expect(first.props).toMatchObject({ query: 'hello', isGuest: false })
    expect(first.props).not.toHaveProperty('id')
  })
})
