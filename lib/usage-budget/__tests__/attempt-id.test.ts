import { describe, expect, it } from 'vitest'

import { isValidUsageAttemptId } from '../attempt-id'

describe('usage attempt IDs', () => {
  it.each([
    'abcdefghijklmnop',
    'tz4p8x1n6m2k9c5v7b3q0w4r',
    '550e8400-e29b-41d4-a716-446655440000'
  ])('accepts a bounded opaque ID: %s', value => {
    expect(isValidUsageAttemptId(value)).toBe(true)
  })

  it.each([
    undefined,
    null,
    '',
    'too-short',
    'contains spaces and punctuation!',
    'a'.repeat(192)
  ])('rejects an invalid ID: %j', value => {
    expect(isValidUsageAttemptId(value)).toBe(false)
  })
})
