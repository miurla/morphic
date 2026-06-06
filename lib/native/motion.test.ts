import { describe, expect, it } from 'vitest'

import { nativeMotion } from './motion'

describe('nativeMotion', () => {
  it('keeps native interaction durations short', () => {
    expect(nativeMotion.duration.instant).toBeLessThan(nativeMotion.duration.fast)
    expect(nativeMotion.duration.fast).toBeLessThan(nativeMotion.duration.normal)
    expect(nativeMotion.duration.normal).toBeLessThan(nativeMotion.duration.sheet)
  })

  it('defines conservative press feedback tokens', () => {
    expect(nativeMotion.press.scale).toBeGreaterThan(0.9)
    expect(nativeMotion.press.scale).toBeLessThan(1)
    expect(nativeMotion.press.subtleScale).toBeGreaterThan(nativeMotion.press.scale)
    expect(nativeMotion.press.subtleScale).toBeLessThan(1)
  })

  it('defines snappy and sheet spring presets', () => {
    expect(nativeMotion.spring.snappy.type).toBe('spring')
    expect(nativeMotion.spring.sheet.type).toBe('spring')
    expect(nativeMotion.spring.snappy.stiffness).toBeGreaterThan(
      nativeMotion.spring.soft.stiffness
    )
  })
})
