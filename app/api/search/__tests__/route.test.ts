import { NextRequest } from 'next/server'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import { HL_START, HL_STOP } from '@/lib/render/highlight-markers'

import { GET } from '../route'

vi.mock('@/lib/auth/get-current-user')
vi.mock('@/lib/db/actions')

function makeRequest(query: string, include?: string) {
  const url = new URL('http://localhost:3000/api/search')
  url.searchParams.set('q', query)
  if (include) {
    url.searchParams.set('include', include)
  }
  return new NextRequest(url.toString())
}

const titleChat = {
  id: 'chat-1',
  createdAt: new Date(),
  title: 'Robert Frost Readings',
  userId: 'user-1',
  visibility: 'private' as const
}

const contentMatch = {
  chatId: 'chat-2',
  title: 'Poetry class',
  snippet: `Stopping by ${HL_START}woods${HL_STOP}`
}

describe('Search API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    vi.mocked(dbActions.searchChatTitles).mockResolvedValue([])
    vi.mocked(dbActions.searchChatContent).mockResolvedValue([])
    vi.mocked(dbActions.searchChatReasoning).mockResolvedValue([])
  })

  it('returns empty groups for unauthenticated requests', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(undefined as never)

    const response = await GET(makeRequest('frost'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      title: [],
      content: []
    })
    expect(dbActions.searchChatTitles).not.toHaveBeenCalled()
    expect(dbActions.searchChatContent).not.toHaveBeenCalled()
  })

  it('returns empty groups for queries shorter than 2 characters', async () => {
    const response = await GET(makeRequest('f'))

    await expect(response.json()).resolves.toEqual({ title: [], content: [] })
    expect(dbActions.searchChatTitles).not.toHaveBeenCalled()
  })

  it('groups title and content matches with caps 20/20', async () => {
    vi.mocked(dbActions.searchChatTitles).mockResolvedValue([titleChat])
    vi.mocked(dbActions.searchChatContent).mockResolvedValue([contentMatch])

    const response = await GET(makeRequest('frost'))

    expect(dbActions.searchChatTitles).toHaveBeenCalledWith(
      'user-1',
      'frost',
      20
    )
    expect(dbActions.searchChatContent).toHaveBeenCalledWith(
      'user-1',
      'frost',
      20
    )
    await expect(response.json()).resolves.toEqual({
      title: [{ chatId: 'chat-1', title: 'Robert Frost Readings' }],
      content: [
        {
          chatId: 'chat-2',
          title: 'Poetry class',
          snippet: 'Stopping by woods',
          highlight: `Stopping by ${HL_START}woods${HL_STOP}`
        }
      ]
    })
  })

  it('omits thinking unless include=reasoning is set', async () => {
    const response = await GET(makeRequest('frost'))
    const body = await response.json()

    expect('thinking' in body).toBe(false)
    expect(dbActions.searchChatReasoning).not.toHaveBeenCalled()
  })

  it('adds thinking results when include=reasoning with cap 10', async () => {
    vi.mocked(dbActions.searchChatReasoning).mockResolvedValue([
      {
        chatId: 'chat-3',
        title: 'Deep chat',
        snippet: `about ${HL_START}frost${HL_STOP}`
      }
    ])

    const response = await GET(makeRequest('frost', 'reasoning'))

    expect(dbActions.searchChatReasoning).toHaveBeenCalledWith(
      'user-1',
      'frost',
      10
    )
    const body = await response.json()
    expect(body.thinking).toEqual([
      {
        chatId: 'chat-3',
        title: 'Deep chat',
        snippet: 'about frost',
        highlight: `about ${HL_START}frost${HL_STOP}`
      }
    ])
  })

  it('returns 500 with empty groups when the search fails', async () => {
    vi.mocked(dbActions.searchChatContent).mockRejectedValue(
      new Error('db down')
    )

    const response = await GET(makeRequest('frost'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ title: [], content: [] })
  })
})
