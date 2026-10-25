import { notFound, redirect } from 'next/navigation'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getChatMeta, loadChat } from '@/lib/actions/chat'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import type { Chat as ChatRow } from '@/lib/db/schema'

import { Chat } from '@/components/chat'

import Page, { generateMetadata } from '../page'

vi.mock('@/lib/actions/chat', () => ({
  getChatMeta: vi.fn(),
  loadChat: vi.fn()
}))
vi.mock('@/lib/auth/get-current-user', () => ({ getCurrentUserId: vi.fn() }))
vi.mock('@/lib/auth/provider', () => ({ isAnonymousMode: () => false }))
vi.mock('@/lib/model-selector/get-model-selector-data', () => ({
  getModelSelectorData: vi.fn(async () => undefined)
}))
vi.mock('@/components/chat', () => ({ Chat: () => null }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('redirect')
  }),
  notFound: vi.fn(() => {
    throw new Error('notFound')
  })
}))

const props = () => ({ params: Promise.resolve({ id: 'chat' }) })
const row: ChatRow = {
  id: 'chat',
  title: 'Title',
  visibility: 'private',
  userId: 'owner',
  createdAt: new Date()
}

describe('saved chat page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('owner')
    vi.mocked(getChatMeta).mockResolvedValue(row)
  })

  it.each(['owner', undefined])(
    'renders metadata only for %s',
    async userId => {
      vi.mocked(getCurrentUserId).mockResolvedValue(userId)
      vi.mocked(getChatMeta).mockResolvedValue({ ...row, visibility: 'public' })
      const tree = await Page(props())
      expect(tree.type).toBe(Chat)
      expect(tree.props).toMatchObject({ id: 'chat', isGuest: !userId })
      expect(tree.props).not.toHaveProperty('savedMessages')
      expect(getChatMeta).toHaveBeenCalledWith('chat', userId)
      expect(loadChat).not.toHaveBeenCalled()
    }
  )

  it('renders an owner private chat without messages', async () => {
    const tree = await Page(props())
    expect(tree.props).not.toHaveProperty('savedMessages')
    expect(redirect).not.toHaveBeenCalled()
    expect(notFound).not.toHaveBeenCalled()
    expect(loadChat).not.toHaveBeenCalled()
  })

  it('redirects logged-out visitors when the row is hidden or missing', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(undefined)
    vi.mocked(getChatMeta).mockResolvedValue(null)
    await expect(Page(props())).rejects.toThrow('redirect')
    expect(redirect).toHaveBeenCalledWith('/auth/login?next=%2Fsearch%2Fchat')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('preserves the private-chat login guard', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(undefined)
    await expect(Page(props())).rejects.toThrow('redirect')
    expect(redirect).toHaveBeenCalledWith('/auth/login?next=%2Fsearch%2Fchat')
  })

  it('returns not found for signed-in visitors when the row is hidden or missing', async () => {
    vi.mocked(getChatMeta).mockResolvedValue(null)
    await expect(Page(props())).rejects.toThrow('notFound')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('uses the row title for metadata without loading messages', async () => {
    vi.mocked(getChatMeta).mockResolvedValue({ ...row, title: 'x'.repeat(60) })
    expect(await generateMetadata(props())).toEqual({ title: 'x'.repeat(50) })
    expect(loadChat).not.toHaveBeenCalled()
  })

  it.each([null, { ...row, title: '' }])(
    'uses the metadata fallback for %s',
    async chat => {
      vi.mocked(getChatMeta).mockResolvedValue(chat)
      expect(await generateMetadata(props())).toEqual({ title: 'Search' })
    }
  )
})
