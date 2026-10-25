import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET, POST } from '../route'

// The route resolves the better-auth handler lazily; the mock stands in for
// the auth endpoint so tests assert on request routing, not on auth itself.
const handler = vi.hoisted(() =>
  vi.fn(() => new Response('from-auth-handler', { status: 200 }))
)

vi.mock('@/lib/auth/better-auth/config', () => ({
  getAuth: () => ({ handler })
}))

function request(method: 'GET' | 'POST', path: string): Request {
  return new Request(`http://localhost/api/auth/${path}`, { method })
}

describe('GET /api/auth/[...all]', () => {
  beforeEach(() => {
    handler.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('lets the identity provider callback through to the auth handler', async () => {
    const req = request('GET', 'callback/oidc')
    const response = await GET(req)

    expect(handler).toHaveBeenCalledWith(req)
    expect(response.status).toBe(200)
  })

  it('accepts the callback path of a custom OIDC_PROVIDER_ID', async () => {
    vi.stubEnv('OIDC_PROVIDER_ID', 'corp-idp')
    const response = await GET(request('GET', 'callback/corp-idp'))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)

    // Any other provider id is not mounted.
    handler.mockClear()
    const other = await GET(request('GET', 'callback/oidc'))
    expect(other.status).toBe(404)
    expect(handler).not.toHaveBeenCalled()
  })

  it('exposes the error endpoint the auth callback redirects to', async () => {
    const response = await GET(request('GET', 'error'))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
  })

  it.each([
    // Credential and sign-up endpoints exist in better-auth but the app only
    // exposes them through server actions, which enforce the invitation and
    // bootstrap-account policy — mounting them would be a bypass.
    request('GET', 'sign-up/email'),
    request('POST', 'sign-up/email'),
    request('GET', 'sign-in/email'),
    request('POST', 'sign-in/email'),
    request('GET', 'reset-password/token123'),
    // The callback is an authorization-response redirect: other methods
    // either do not occur or must not be answered.
    request('POST', 'callback/oidc'),
    // Path traversal and nested segments are not callbacks.
    request('GET', 'callback/../sign-up/email'),
    request('GET', 'callback/oidc/extra'),
    request('GET', 'unknown/oidc')
  ])('answers %s with 404 and never touches the auth handler', async req => {
    const dispatch = req.method === 'POST' ? POST : GET
    const response = await dispatch(req)

    expect(response.status).toBe(404)
    expect(handler).not.toHaveBeenCalled()
  })
})
