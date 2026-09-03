// @vitest-environment node
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isToolFailureError } from '@/lib/errors/tool-error'
import { fetchTool } from '@/lib/tools/fetch'

const CREDENTIALS = '{"AccessKeyId":"AKIAEXAMPLE","SecretAccessKey":"s3cret"}'

function run(url: string, type: 'regular' | 'api') {
  const result = fetchTool.execute?.(
    { url, type },
    { toolCallId: 'fetch', messages: [], context: {} }
  )
  return (result as AsyncIterable<unknown>)[Symbol.asyncIterator]()
}

async function expectBlocked(url: string, type: 'regular' | 'api' = 'regular') {
  const iterator = run(url, type)

  try {
    // The refusal lands before the first yield when the URL alone settles it,
    // and after it when the address is only known once the socket opens.
    await iterator.next()
    await iterator.next()
    throw new Error('Expected fetch tool to throw')
  } catch (error) {
    expect(isToolFailureError(error)).toBe(true)
    if (isToolFailureError(error)) {
      expect(error.originalMessage).toBe('Blocked fetch URL.')
    }
  }
}

/**
 * A stand-in metadata endpoint, reached by name so that neither the literal
 * check nor the resolving one is what refuses it: only the connect-time lookup
 * inside the agent can.
 */
async function withPrivateHost(
  body: (port: number, hits: () => number) => Promise<void>
) {
  let hits = 0
  const server = http.createServer((_, res) => {
    hits += 1
    res.setHeader('content-type', 'application/json')
    res.end(CREDENTIALS)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  try {
    await body(port, () => hits)
  } finally {
    await new Promise<void>(resolve => {
      server.close(() => resolve())
    })
  }
}

describe('fetch tool SSRF guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('refuses a private literal without a network call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expectBlocked('http://169.254.169.254/latest/meta-data/')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  // The extraction service does the requesting, so the name has to be settled
  // before it is handed over rather than at connect time.
  it('refuses a name that resolves into private space on the API path', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('JINA_API_KEY', 'test-key')

    await expectBlocked('http://localhost/admin', 'api')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never reaches a live private host, and never returns its body', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withPrivateHost(async (port, hits) => {
      await expectBlocked(`http://localhost:${port}/creds`)
      expect(hits()).toBe(0)
    })
  })

  // The control: without it, a guard that refuses everything would look the
  // same as one that refuses the right thing.
  it('reads the same host once the network is opted in', async () => {
    vi.stubEnv('FETCH_ALLOW_PRIVATE_NETWORK', 'true')

    await withPrivateHost(async (port, hits) => {
      const iterator = run(`http://localhost:${port}/creds`, 'regular')
      await iterator.next()
      const result = await iterator.next()

      expect(result.value).toMatchObject({ state: 'complete' })
      expect(JSON.stringify(result.value)).toContain('SecretAccessKey')
      expect(hits()).toBe(1)
    })
  })
})
