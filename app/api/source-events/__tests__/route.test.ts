import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRecordSourceEvent = vi.fn()
const mockGetUser = vi.fn()
const mockHasSupabasePublicConfig = vi.fn(() => false)

vi.mock('@/lib/actions/source-events', () => ({
  recordSourceEvent: (...args: unknown[]) => mockRecordSourceEvent(...args)
}))

vi.mock('@/lib/supabase/keys', () => ({
  hasSupabasePublicConfig: () => mockHasSupabasePublicConfig()
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser
      }
    })
  )
}))

import { POST } from '../route'

describe('Source events API route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasSupabasePublicConfig.mockReturnValue(false)
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    mockRecordSourceEvent.mockResolvedValue({ success: true })
  })

  it('records an anonymous source event with server-derived normalized URL metadata', async () => {
    const request = new Request('http://localhost:3000/api/source-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'open_original',
        sourceId: 'source_search_abc',
        sourceUrl: 'https://Example.com/report?utm_source=news&b=2&a=1#frag',
        pageUrl: '/search/chat_123?query=private',
        metadata: {
          sourceKind: 'web',
          provider: 'qwant',
          retrievalMethod: 'search',
          rank: 1,
          ignored: 'not persisted'
        }
      })
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body).toEqual({ ok: true, stored: true })
    expect(mockRecordSourceEvent).toHaveBeenCalledWith({
      userId: null,
      eventType: 'open_original',
      sourceId: 'source_search_abc',
      sourceUrl: 'https://example.com/report?a=1&b=2',
      sourceDomain: 'example.com',
      pageUrl: '/search/chat_123',
      metadata: {
        sourceKind: 'web',
        provider: 'qwant',
        retrievalMethod: 'search',
        rank: 1
      }
    })
  })

  it('associates the current user when Supabase auth is configured', async () => {
    mockHasSupabasePublicConfig.mockReturnValue(true)
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user_123' } },
      error: null
    })

    const request = new Request('http://localhost:3000/api/source-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'impression',
        sourceUrl: 'https://example.com/report'
      })
    })

    await POST(request)

    expect(mockRecordSourceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_123' })
    )
  })

  it('rejects unsupported event types', async () => {
    const request = new Request('http://localhost:3000/api/source-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'delete_all_sources',
        sourceUrl: 'https://example.com/report'
      })
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(mockRecordSourceEvent).not.toHaveBeenCalled()
  })

  it('rejects non-http source URLs', async () => {
    const request = new Request('http://localhost:3000/api/source-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'open_original',
        sourceUrl: 'javascript:alert(1)'
      })
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(mockRecordSourceEvent).not.toHaveBeenCalled()
  })

  it('rejects oversized metadata before persistence', async () => {
    const request = new Request('http://localhost:3000/api/source-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'open_original',
        sourceUrl: 'https://example.com/report',
        metadata: {
          provider: 'x'.repeat(4097)
        }
      })
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(mockRecordSourceEvent).not.toHaveBeenCalled()
  })

  it('does not fail the caller when analytics persistence fails', async () => {
    mockRecordSourceEvent.mockResolvedValue({
      success: false,
      error: 'database unavailable'
    })
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const request = new Request('http://localhost:3000/api/source-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'open_original',
        sourceUrl: 'https://example.com/report'
      })
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body).toEqual({ ok: true, stored: false })
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Source event persistence failed:',
      'database unavailable'
    )

    consoleErrorSpy.mockRestore()
  })
})
