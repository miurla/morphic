import { describe, expect, it } from 'vitest'

import {
  buildStreamErrorShape,
  buildStreamErrorSpanUpdate,
  isStreamAbortError
} from '../stream-error-diagnostics'

describe('isStreamAbortError', () => {
  it.each(['AbortError', 'ResponseAborted'])('recognizes %s errors', name => {
    const error = new Error('request stopped')
    error.name = name

    expect(isStreamAbortError(error)).toBe(true)
  })

  it('recognizes an abort DOMException', () => {
    expect(
      isStreamAbortError(new DOMException('request stopped', 'AbortError'))
    ).toBe(true)
  })

  it('recognizes an abort error in the cause', () => {
    const cause = new Error('request stopped')
    cause.name = 'ResponseAborted'

    expect(isStreamAbortError(new Error('wrapper', { cause }))).toBe(true)
  })

  it.each([
    new Error('AbortError'),
    Object.assign(new Error('tool timed out'), { name: 'TimeoutError' }),
    { name: 'AbortError' },
    new Error('ordinary failure')
  ])('does not recognize non-abort errors', error => {
    expect(isStreamAbortError(error)).toBe(false)
  })
})

describe('buildStreamErrorShape', () => {
  it('returns null for a classified error', () => {
    expect(buildStreamErrorShape(new Error('rate limit exceeded'))).toBeNull()
  })

  it('returns names and library identifiers for an unclassified error', () => {
    const cause = Object.assign(new Error('private cause message'), {
      name: 'ProviderFailure',
      code: 'CAUSE_CODE'
    })
    const error = Object.assign(new Error('private top-level message'), {
      name: 'SDKFailure',
      code: 'SDK_CODE',
      errno: 73,
      cause
    })

    expect(buildStreamErrorShape(error)).toEqual({
      name: 'SDKFailure',
      code: 'SDK_CODE',
      errno: 73,
      cause: {
        name: 'ProviderFailure',
        code: 'CAUSE_CODE'
      }
    })
  })

  it('never includes message text and caps string identifiers', () => {
    const sentinel = 'PRIVATE_USER_CONTENT'
    const error = Object.assign(new Error(sentinel), {
      name: `Failure${'x'.repeat(200)}`,
      code: `CODE${'y'.repeat(200)}`,
      errno: `ERRNO${'z'.repeat(200)}`
    })

    const shape = buildStreamErrorShape(error)
    const output = JSON.stringify(shape)

    expect(output).not.toContain(sentinel)
    expect(shape?.name).toHaveLength(128)
    expect(shape?.code).toHaveLength(128)
    expect(shape?.errno).toHaveLength(128)
  })
})

describe('buildStreamErrorSpanUpdate', () => {
  it('returns null for an aborted turn', () => {
    const error = new Error('request stopped')
    error.name = 'AbortError'

    expect(buildStreamErrorSpanUpdate(error, true)).toBeNull()
  })

  it('keeps an abort-named failure on the error surface when the request was not cancelled', () => {
    const error = new Error('upstream timed out')
    error.name = 'AbortError'

    expect(buildStreamErrorSpanUpdate(error, false)?.level).toBe('ERROR')
  })

  it('carries no metadata for a classified failure', () => {
    const update = buildStreamErrorSpanUpdate(
      new Error('rate limit exceeded'),
      false
    )

    expect(update?.level).toBe('ERROR')
    expect(update?.statusMessage).toContain('provider_rate_limit')
    expect(update).not.toHaveProperty('metadata')
  })
})
