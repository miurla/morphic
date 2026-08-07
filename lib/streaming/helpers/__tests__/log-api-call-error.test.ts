import { APICallError } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildAPICallErrorDiagnostics,
  logAPICallErrorDiagnostics
} from '../log-api-call-error'

function createAPICallError(
  requestBodyValues: unknown,
  responseBody = 'Invalid body'
) {
  return new APICallError({
    message: 'Invalid request',
    url: 'https://provider.example/v1/messages',
    requestBodyValues,
    statusCode: 400,
    responseBody
  })
}

describe('logAPICallErrorDiagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ignores non-API call errors without throwing', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    expect(() => logAPICallErrorDiagnostics(new Error('failure'))).not.toThrow()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('logs API call details and a structural request summary', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const error = createAPICallError({
      model: 'provider-model',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'private user message' },
            { type: 'file', data: 'private file data' }
          ]
        }
      ]
    })

    logAPICallErrorDiagnostics(error)

    expect(consoleError).toHaveBeenCalledWith(
      'Provider API call diagnostics:',
      '{"statusCode":400,"url":"https://provider.example/v1/messages","requestBody":{"topLevelKeys":["model","messages"],"totalSerializedSize":156,"turnsKey":"messages","turnCount":1,"turns":[{"role":"user","content":[{"type":"text","length":45},{"type":"file","length":42}]}]},"responseBody":{"length":12}}'
    )
    const output = consoleError.mock.calls.flat().join(' ')
    expect(output).toContain('"statusCode":400')
    expect(output).toContain('https://provider.example/v1/messages')
    expect(output).toContain('"topLevelKeys":["model","messages"]')
    expect(output).toContain('"totalSerializedSize":')
    expect(output).toContain('"turnsKey":"messages"')
    expect(output).toContain('"role":"user"')
    expect(output).toContain('"type":"text"')
    expect(output).toContain('"type":"file"')
    expect(output).not.toContain('private user message')
    expect(output).not.toContain('private file data')
  })

  it('keeps the request summary when the response body is long', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const error = createAPICallError(
      { model: 'provider-model', messages: [{ role: 'user', content: 'hi' }] },
      'x'.repeat(20_000)
    )

    logAPICallErrorDiagnostics(error)

    const output = consoleError.mock.calls.flat().join(' ')
    expect(output).toContain('"topLevelKeys":["model","messages"]')
    expect(output).toContain('"role":"user"')
  })

  it('summarizes the response body without echoing its content', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const error = createAPICallError(
      { messages: [{ role: 'user', content: 'hi' }] },
      JSON.stringify({
        error: {
          type: 'invalid_request_error',
          code: 'invalid_body',
          message: 'Invalid body near "leaked secret fragment"'
        }
      })
    )

    logAPICallErrorDiagnostics(error)

    const output = consoleError.mock.calls.flat().join(' ')
    expect(output).toContain('"type":"invalid_request_error"')
    expect(output).toContain('"code":"invalid_body"')
    expect(output).toContain('"length":')
    expect(output).not.toContain('leaked secret fragment')
  })

  it('summarizes turns for providers that do not use a messages key', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const error = createAPICallError({
      model: 'provider-model',
      input: [
        { role: 'user', content: [{ type: 'input_text', text: 'private' }] }
      ]
    })

    logAPICallErrorDiagnostics(error)

    const output = consoleError.mock.calls.flat().join(' ')
    expect(output).toContain('"turnsKey":"input"')
    expect(output).toContain('"turnCount":1')
    expect(output).toContain('"type":"input_text"')
    expect(output).not.toContain('private')
  })

  it('summarizes google style contents with parts', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const error = createAPICallError({
      contents: [{ role: 'user', parts: [{ text: 'private' }] }]
    })

    logAPICallErrorDiagnostics(error)

    const output = consoleError.mock.calls.flat().join(' ')
    expect(output).toContain('"turnsKey":"contents"')
    expect(output).toContain('"turnCount":1')
    expect(output).not.toContain('private')
  })

  it('truncates oversized diagnostics', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const error = createAPICallError({
      messages: Array.from({ length: 500 }, () => ({
        role: 'user',
        content: [{ type: 'text', text: 'content' }]
      }))
    })

    logAPICallErrorDiagnostics(error)

    const diagnostics = consoleError.mock.calls[0][1]
    expect(diagnostics).toHaveLength(4000)
    expect(diagnostics.endsWith('...[truncated]')).toBe(true)
  })
})

describe('buildAPICallErrorDiagnostics', () => {
  it.each([new Error('failure'), null, undefined, 'failure'])(
    'returns null for a non-API call error',
    value => {
      expect(buildAPICallErrorDiagnostics(value)).toBeNull()
    }
  )

  it('returns structural API call diagnostics without private content', () => {
    const sentinel = 'SENTINEL_PRIVATE_MESSAGE_20260807'
    const error = createAPICallError({
      model: 'provider-model',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: sentinel },
            { type: 'file', data: 'private file data' }
          ]
        }
      ]
    })

    const diagnostics = buildAPICallErrorDiagnostics(error)

    expect(diagnostics).toEqual({
      statusCode: 400,
      url: 'https://provider.example/v1/messages',
      requestBody: {
        topLevelKeys: ['model', 'messages'],
        totalSerializedSize: 169,
        turnsKey: 'messages',
        turnCount: 1,
        turns: [
          {
            role: 'user',
            content: [
              { type: 'text', length: 58 },
              { type: 'file', length: 42 }
            ]
          }
        ]
      },
      responseBody: { length: 12 }
    })
    expect(JSON.stringify(diagnostics)).not.toContain(sentinel)
  })
})
