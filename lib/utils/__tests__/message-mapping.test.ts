import { describe, expect, it } from 'vitest'

import { DeterministicPreparationError } from '@/lib/errors/deterministic-preparation-error'
import type { DBMessagePartSelect } from '@/lib/types/message-persistence'

import {
  mapDBPartToUIMessagePart,
  mapUIMessagePartsToDBParts
} from '../message-mapping'

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

describe('editDraft tool parts', () => {
  it('round-trips through the dynamic tool columns', () => {
    const uiPart = {
      type: 'tool-editDraft',
      toolCallId: 'call-1',
      state: 'output-available',
      input: { edits: [{ find: 'a', replace: 'b' }] },
      output: { applied: 1, failed: [] }
    }
    const [dbPart] = mapUIMessagePartsToDBParts([uiPart] as never, 'msg-1')

    expect(dbPart.type).toBe('tool-dynamic')
    expect(dbPart.tool_dynamic_type).toBe('draft')

    const restored = mapDBPartToUIMessagePart(
      persistedPart(dbPart as Partial<DBMessagePartSelect>)
    )
    expect(restored).toMatchObject(uiPart)
  })
})
