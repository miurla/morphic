import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentUserId = vi.fn()
const mockListReadingItems = vi.fn()
const mockSaveReadingItem = vi.fn()
const mockUpdateReadingItemStatus = vi.fn()

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: () => mockGetCurrentUserId()
}))

vi.mock('@/lib/actions/reading-items', () => ({
  listReadingItems: (...args: unknown[]) => mockListReadingItems(...args),
  saveReadingItem: (...args: unknown[]) => mockSaveReadingItem(...args),
  updateReadingItemStatus: (...args: unknown[]) =>
    mockUpdateReadingItemStatus(...args)
}))

import { GET, PATCH, POST } from '../route'

describe('Reading items API route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUserId.mockResolvedValue('user_123')
    mockListReadingItems.mockResolvedValue({ success: true, items: [] })
    mockSaveReadingItem.mockResolvedValue({
      success: true,
      item: { id: 'reading_123' },
      created: true
    })
    mockUpdateReadingItemStatus.mockResolvedValue({
      success: true,
      item: { id: 'reading_123', status: 'read' }
    })
  })

  it('requires a signed-in or configured anonymous user', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)

    const response = await POST(
      new Request('http://localhost:3000/api/reading-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/article',
          title: 'Example article'
        })
      })
    )

    expect(response.status).toBe(401)
    expect(mockSaveReadingItem).not.toHaveBeenCalled()
  })

  it('saves a normalized reading item for the current user', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/reading-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: 'source_123',
          url: 'https://Example.com/article?utm_source=feed#section',
          title: ' Example article ',
          siteName: 'Example',
          domain: 'example.com',
          summary: 'A concise summary',
          savedFromChatId: 'chat_123'
        })
      })
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toEqual({
      ok: true,
      item: { id: 'reading_123' },
      created: true
    })
    expect(mockSaveReadingItem).toHaveBeenCalledWith('user_123', {
      sourceId: 'source_123',
      url: 'https://example.com/article',
      canonicalUrl: 'https://example.com/article',
      title: 'Example article',
      siteName: 'Example',
      domain: 'example.com',
      summary: 'A concise summary',
      savedFromChatId: 'chat_123'
    })
  })

  it('returns 200 when saving an existing canonical URL', async () => {
    mockSaveReadingItem.mockResolvedValue({
      success: true,
      item: { id: 'reading_123' },
      created: false
    })

    const response = await POST(
      new Request('http://localhost:3000/api/reading-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/article',
          title: 'Example article'
        })
      })
    )

    expect(response.status).toBe(200)
  })

  it('lists only the current user reading items', async () => {
    mockListReadingItems.mockResolvedValue({
      success: true,
      items: [{ id: 'reading_123', title: 'Saved article' }]
    })

    const response = await GET(
      new Request('http://localhost:3000/api/reading-items')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      items: [{ id: 'reading_123', title: 'Saved article' }]
    })
    expect(mockListReadingItems).toHaveBeenCalledWith('user_123', {
      status: undefined
    })
  })

  it('updates reading status for the current user', async () => {
    const response = await PATCH(
      new Request('http://localhost:3000/api/reading-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'reading_123',
          status: 'read'
        })
      })
    )

    expect(response.status).toBe(200)
    expect(mockUpdateReadingItemStatus).toHaveBeenCalledWith(
      'user_123',
      'reading_123',
      'read'
    )
  })

  it('rejects unsupported status transitions', async () => {
    const response = await PATCH(
      new Request('http://localhost:3000/api/reading-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'reading_123',
          status: 'deleted'
        })
      })
    )

    expect(response.status).toBe(400)
    expect(mockUpdateReadingItemStatus).not.toHaveBeenCalled()
  })
})
