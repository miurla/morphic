import { describe, expect, it } from 'vitest'

import { DeterministicPreparationError } from '@/lib/errors/deterministic-preparation-error'
import type { DBMessagePartSelect } from '@/lib/types/message-persistence'

import { mapDBPartToUIMessagePart } from '../message-mapping'

function persistedPart(
  values: Partial<DBMessagePartSelect>
): DBMessagePartSelect {
  return values as DBMessagePartSelect
}

describe('mapDBPartToUIMessagePart', () => {
  it('identifies an unmappable persisted part as deterministic', () => {
    expect(() =>
      mapDBPartToUIMessagePart(persistedPart({ type: 'private-user-content' }))
    ).toThrow(DeterministicPreparationError)
  })

  it('identifies a missing persisted tool state as deterministic', () => {
    expect(() =>
      mapDBPartToUIMessagePart(
        persistedPart({ type: 'tool-search', tool_state: null })
      )
    ).toThrow(DeterministicPreparationError)
  })
})
