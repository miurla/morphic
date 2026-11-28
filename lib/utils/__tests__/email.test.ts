import { describe, expect, it } from 'vitest'

import { hasEmailShape, isValidEmail, MAX_EMAIL_LENGTH } from '../email'

// The quadratic regex that hasEmailShape replaces.
const LEGACY_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

describe('hasEmailShape', () => {
  it('agrees with the legacy regex on every short string over a small alphabet', () => {
    const alphabet = ['a', '@', '.', ' ']
    let checked = 0
    const visit = (prefix: string, depth: number) => {
      expect(hasEmailShape(prefix), JSON.stringify(prefix)).toBe(
        LEGACY_EMAIL_REGEX.test(prefix)
      )
      checked++
      if (depth === 0) return
      for (const ch of alphabet) visit(prefix + ch, depth - 1)
    }
    visit('', 7)
    expect(checked).toBeGreaterThan(20_000)
  })

  it('agrees with the legacy regex on whitespace beyond the ASCII space', () => {
    for (const email of ['a@b.c x', 'a@b\t.c', 'a\n@b.c', 'a@b.c ']) {
      expect(hasEmailShape(email)).toBe(LEGACY_EMAIL_REGEX.test(email))
    }
  })

  // The scan has no length guard, so these inputs reach all of it. Timing
  // is compared against the same function at a smaller size instead of an
  // absolute budget, so a slow CI machine does not change the outcome. Both
  // sizes do the same total number of characters of work (reps * n), so a
  // linear scan gives a ratio near 1 while the quadratic regex gives ~10.
  const adversarial: Array<[string, (n: number) => string]> = [
    ['dots then a second @', n => `a@${'.'.repeat(n)}@`],
    ['dots with no further @', n => `a@${'.'.repeat(n)}`],
    ['no dot in the domain', n => `a@${'x'.repeat(n)}`],
    ['whitespace at the end', n => `a@b.${'x'.repeat(n)} `]
  ]

  function perCharWork(build: (n: number) => string, n: number): number {
    const input = build(n)
    const reps = Math.ceil(2_000_000 / n)
    let best = Infinity
    for (let sample = 0; sample < 5; sample++) {
      const start = performance.now()
      for (let i = 0; i < reps; i++) hasEmailShape(input)
      best = Math.min(best, performance.now() - start)
    }
    return best
  }

  it.each(adversarial)('scales linearly on %s', (_name, build) => {
    // Warm up so JIT compilation is not charged to the first size.
    perCharWork(build, 5_000)
    const small = perCharWork(build, 5_000)
    const large = perCharWork(build, 50_000)
    // Linear: ~1. Quadratic over a 10x size step: ~10. Threshold sits
    // between them with room for timer noise.
    expect(large / Math.max(small, 0.05)).toBeLessThan(5)
  })
})

describe('isValidEmail', () => {
  it('accepts an address of exactly MAX_EMAIL_LENGTH and rejects one more', () => {
    const atLimit = `${'a'.repeat(MAX_EMAIL_LENGTH - '@example.com'.length)}@example.com`
    expect(atLimit).toHaveLength(MAX_EMAIL_LENGTH)
    expect(isValidEmail(atLimit)).toBe(true)
    expect(isValidEmail(`a${atLimit}`)).toBe(false)
  })

  it('rejects an oversized input at the guard even when its shape is valid', () => {
    const oversized = `a@${'b'.repeat(MAX_EMAIL_LENGTH)}.com`
    expect(hasEmailShape(oversized)).toBe(true)
    expect(isValidEmail(oversized)).toBe(false)
  })
})
