// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { tutorChunks } from '../tutor-schema'

describe('Tutor embedding storage', () => {
  it('round-trips both existing and new vector dimensions without resizing', () => {
    const column = tutorChunks.embedding
    expect(column.getSQLType()).toBe('vector')
    for (const dimensions of [1536, 1024]) {
      const values = Array.from({ length: dimensions }, (_, index) =>
        index === 0 ? 0.25 : -0.125
      )
      expect(
        column.mapFromDriverValue(column.mapToDriverValue(values))
      ).toEqual(values)
    }
  })
})
