import { NextRequest } from 'next/server'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadChat } from '@/lib/actions/chat'
import { getCurrentUserId } from '@/lib/auth/get-current-user'

import { GET } from '../route'

vi.mock('@/lib/actions/chat', () => ({ loadChat: vi.fn() }))
vi.mock('@/lib/auth/get-current-user', () => ({ getCurrentUserId: vi.fn() }))

const request = () =>
  GET(new NextRequest('http://localhost/api/chats/chat'), {
    params: Promise.resolve({ id: 'chat' })
  })

describe('GET /api/chats/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('owner')
  })
  it('returns the owner history without caching', async () => {
    const chat = {
      id: 'chat',
      title: 'Title',
      visibility: 'private',
      userId: 'owner',
      messages: [],
      createdAt: new Date()
    }
    vi.mocked(loadChat).mockResolvedValue(
      chat as Awaited<ReturnType<typeof loadChat>>
    )
    const result = await request()
    expect(result.status).toBe(200)
    expect(result.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await result.json()).toEqual({
      id: 'chat',
      title: 'Title',
      visibility: 'private',
      userId: 'owner',
      messages: []
    })
    expect(loadChat).toHaveBeenCalledWith('chat', 'owner')
  })
  it('returns 404 when the loader hides missing or inaccessible chats', async () => {
    vi.mocked(loadChat).mockResolvedValue(null)
    const result = await request()
    expect(result.status).toBe(404)
    expect(await result.json()).toEqual({ error: 'Chat not found' })
  })
  it('rejects guests before loading a chat', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(undefined)
    expect((await request()).status).toBe(401)
    expect(loadChat).not.toHaveBeenCalled()
  })
})
