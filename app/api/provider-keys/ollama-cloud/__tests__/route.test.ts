import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cookieValue = vi.hoisted(() => ({
  current: undefined as string | undefined
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === 'ollama_cloud_api_key' && cookieValue.current
        ? { name, value: cookieValue.current }
        : undefined
  }))
}))

import { DELETE, GET, POST } from '../route'

describe('Ollama Cloud provider key API route', () => {
  beforeEach(() => {
    cookieValue.current = undefined
  })

  afterEach(() => {
    delete process.env.OLLAMA_API_KEY
  })

  it('reports configured state without returning the key', async () => {
    cookieValue.current = 'ollama-user-key'

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, configured: true, source: 'user' })
    expect(JSON.stringify(body)).not.toContain('ollama-user-key')
  })

  it('falls back to environment key status without exposing it', async () => {
    process.env.OLLAMA_API_KEY = 'ollama-env-key'

    const response = await GET()
    const body = await response.json()

    expect(body).toEqual({
      ok: true,
      configured: true,
      source: 'environment'
    })
    expect(JSON.stringify(body)).not.toContain('ollama-env-key')
  })

  it('sets an HttpOnly key cookie without echoing the secret in JSON', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/provider-keys/ollama-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'ollama-user-key' })
      })
    )
    const body = await response.json()
    const cookie = response.headers.get('set-cookie') || ''

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, configured: true, source: 'user' })
    expect(JSON.stringify(body)).not.toContain('ollama-user-key')
    expect(cookie).toContain('ollama_cloud_api_key=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=lax')
    expect(cookie).toContain('Path=/')
  })

  it('rejects malformed keys', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/provider-keys/ollama-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'bad key with spaces' })
      })
    )

    expect(response.status).toBe(400)
  })

  it('deletes only the user cookie and keeps environment status', async () => {
    process.env.OLLAMA_API_KEY = 'ollama-env-key'

    const response = await DELETE()
    const body = await response.json()
    const cookie = response.headers.get('set-cookie') || ''

    expect(body).toEqual({
      ok: true,
      configured: true,
      source: 'environment'
    })
    expect(cookie).toContain('ollama_cloud_api_key=')
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('HttpOnly')
  })
})
