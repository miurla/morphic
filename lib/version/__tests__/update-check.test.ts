import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getVersionCheckConfig } from '../config'
import { checkForUpdate, resetFailureBackoff } from '../update-check'

vi.mock('../config', () => ({
  getVersionCheckConfig: vi.fn()
}))

const mockedGetConfig = vi.mocked(getVersionCheckConfig)

function mockFetchSuccess(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body
  })
}

describe('checkForUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetFailureBackoff()
    mockedGetConfig.mockReturnValue({
      repo: 'miurla/morphic',
      ttlSeconds: 86400,
      disabled: false
    })
  })

  test('reports an update for a newer upstream release', async () => {
    // html_url is deliberately hostile: the release link must be built from
    // the configured repo and the parsed tag, never from the response body.
    const fetchMock = mockFetchSuccess({
      tag_name: 'v1.8.0',
      html_url: 'https://redirect.example.com/not-trusted'
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await checkForUpdate('1.7.0')

    expect(result).toEqual({
      hasUpdate: true,
      latestVersion: 'v1.8.0',
      releaseUrl: 'https://github.com/miurla/morphic/releases/tag/v1.8.0'
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/miurla/morphic/releases/latest',
      expect.objectContaining({
        next: { revalidate: 86400 },
        headers: { accept: 'application/vnd.github+json' },
        signal: expect.any(AbortSignal)
      })
    )

    vi.unstubAllGlobals()
  })

  test('reports no update when upstream is at or behind the running version', async () => {
    vi.stubGlobal('fetch', mockFetchSuccess({ tag_name: 'v1.7.0' }))

    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })

    vi.unstubAllGlobals()
  })

  test('degrades to no-update on timeout', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  test('degrades to no-update on a 403 rate-limit response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 })
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  test.each([
    {
      name: 'json body is not valid JSON',
      response: {
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON')
        }
      }
    },
    {
      name: 'payload lacks a tag',
      response: { ok: true, status: 200, json: async () => ({}) }
    },
    {
      name: 'payload has an unparseable prerelease tag',
      response: {
        ok: true,
        status: 200,
        json: async () => ({ tag_name: 'v1.8.0-rc1' })
      }
    }
  ])(
    'degrades to no-update on a malformed payload: $name',
    async ({ response }) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })

      warnSpy.mockRestore()
      vi.unstubAllGlobals()
    }
  )

  test('makes no upstream request when the check is disabled', async () => {
    mockedGetConfig.mockReturnValue({
      repo: 'miurla/morphic',
      ttlSeconds: 86400,
      disabled: true
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })
    expect(fetchMock).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  test('concurrent calls share a single upstream request', async () => {
    let settleFetch!: (response: unknown) => void
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          settleFetch = resolve
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    const first = checkForUpdate('1.7.0')
    const second = checkForUpdate('1.7.0')
    settleFetch({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'v1.8.0' })
    })

    const [r1, r2] = await Promise.all([first, second])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(r1).toEqual({
      hasUpdate: true,
      latestVersion: 'v1.8.0',
      releaseUrl: 'https://github.com/miurla/morphic/releases/tag/v1.8.0'
    })
    expect(r2).toEqual(r1)

    vi.unstubAllGlobals()
  })

  test('concurrent calls share a single request when the upstream fails', async () => {
    let failFetch!: (error: unknown) => void
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          failFetch = reject
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const first = checkForUpdate('1.7.0')
    const second = checkForUpdate('1.7.0')
    failFetch(new TypeError('fetch failed'))

    expect(await Promise.all([first, second])).toEqual([
      { hasUpdate: false },
      { hasUpdate: false }
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  test('concurrent calls with different versions compare against the shared tag', async () => {
    let settleFetch!: (response: unknown) => void
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          settleFetch = resolve
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    // Both join one request; each compares the shared tag against its own
    // version: 1.9.0 is ahead of v1.8.0 (no update), 1.7.0 is behind (update).
    const ahead = checkForUpdate('1.9.0')
    const behind = checkForUpdate('1.7.0')
    settleFetch({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'v1.8.0' })
    })

    expect(await ahead).toEqual({ hasUpdate: false })
    expect(await behind).toEqual({
      hasUpdate: true,
      latestVersion: 'v1.8.0',
      releaseUrl: 'https://github.com/miurla/morphic/releases/tag/v1.8.0'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  test('negative cache suppresses retries after a network failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetchMock)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })
    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })
    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  test('negative cache suppresses retries after a non-2xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 })
    vi.stubGlobal('fetch', fetchMock)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })
    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  test('negative cache suppresses retries after an unusable release tag', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'nightly-2026-10-01' })
    })
    vi.stubGlobal('fetch', fetchMock)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })
    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  test('a successful check clears the negative cache', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    await checkForUpdate('1.7.0')
    vi.unstubAllGlobals()

    // Simulate the TTL window passing, then a successful check.
    resetFailureBackoff()
    vi.stubGlobal('fetch', mockFetchSuccess({ tag_name: 'v1.7.0' }))
    expect(await checkForUpdate('1.7.0')).toEqual({ hasUpdate: false })
    vi.unstubAllGlobals()

    // The success cleared the backoff, so the next failure is attempted.
    const failMock = vi.fn().mockRejectedValue(new Error('down'))
    vi.stubGlobal('fetch', failMock)
    await checkForUpdate('1.7.0')
    expect(failMock).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})
