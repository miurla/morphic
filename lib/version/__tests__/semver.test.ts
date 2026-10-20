import { describe, expect, test } from 'vitest'

import { isUpdateAvailable, parseReleaseTag } from '../semver'

describe('parseReleaseTag', () => {
  test.each([
    { tag: 'v1.8.0', expected: { major: 1, minor: 8, patch: 0 } },
    { tag: '1.8.0', expected: { major: 1, minor: 8, patch: 0 } },
    { tag: 'v0.0.1', expected: { major: 0, minor: 0, patch: 1 } },
    { tag: 'v1.8.0-rc1', expected: null },
    { tag: 'v1.8', expected: null },
    { tag: 'v1', expected: null },
    { tag: 'release-1.8.0', expected: null },
    { tag: '', expected: null }
  ])('parses $tag', ({ tag, expected }) => {
    expect(parseReleaseTag(tag)).toEqual(expected)
  })
})

describe('isUpdateAvailable', () => {
  test.each([
    { current: '1.7.0', tag: 'v1.8.0', expected: true },
    { current: '1.7.0', tag: 'v2.0.0', expected: true },
    { current: '1.7.0', tag: 'v1.7.1', expected: true },
    { current: '1.7.0', tag: '1.8.0', expected: true },
    { current: '1.7.0', tag: 'v1.7.0', expected: false },
    { current: '1.7.0', tag: 'v1.6.9', expected: false },
    { current: '2.0.0', tag: 'v1.9.9', expected: false },
    { current: '1.7.0', tag: 'v1.8.0-rc1', expected: false },
    { current: '1.7.0', tag: 'not-a-version', expected: false },
    { current: 'not-a-version', tag: 'v1.8.0', expected: false }
  ])('current $current vs $tag', ({ current, tag, expected }) => {
    expect(isUpdateAvailable(current, tag)).toBe(expected)
  })
})
