import { describe, expect, it } from 'vitest'

import { PERSONALIZATION_COOKIE_NAME } from '@/lib/agents/personalization'

import { POST } from '../route'

describe('personalization API route', () => {
  it('sanitizes personalization and sets an HttpOnly cookie', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          aboutUser: ' Alice\u0000 ',
          responseStyle: ' concise ',
          instructions: ' prefer primary sources ',
          useForSearch: true
        })
      })
    )

    const body = await response.json()
    const cookie = response.headers.get('set-cookie') || ''

    expect(response.status).toBe(200)
    expect(body.personalization).toEqual({
      enabled: true,
      aboutUser: 'Alice',
      responseStyle: 'concise',
      instructions: 'prefer primary sources',
      useForSearch: true
    })
    expect(cookie).toContain(`${PERSONALIZATION_COOKIE_NAME}=`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=lax')
    expect(cookie).toContain('Path=/')
  })

  it('rejects malformed JSON payloads', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{'
      })
    )

    expect(response.status).toBe(400)
  })
})
