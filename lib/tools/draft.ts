import { tool } from 'ai'
import { z } from 'zod'

import { applyDraftEdits, type DraftVersion } from '@/lib/draft/draft'

export const editDraftInputSchema = z.object({
  edits: z
    .array(
      z.object({
        find: z
          .string()
          .describe(
            'Exact text copied from the current draft. It must appear exactly once; include enough surrounding text to make it unique.'
          ),
        replace: z.string().describe('The text that replaces it')
      })
    )
    .min(1)
    .describe('Edits applied in order')
})

/**
 * Edit the chat's current draft in place. The draft is rebuilt from history
 * before the turn, so this only ever sees the version the model was shown.
 */
export function createDraftTools(currentDraft: DraftVersion | null) {
  let current = currentDraft

  const editDraft = tool({
    description:
      'Make local changes to the current draft with exact find/replace edits. For a full rewrite, write a new draft block instead.',
    inputSchema: editDraftInputSchema,
    execute: async ({ edits }) => {
      if (!current) {
        return {
          applied: 0,
          failed: [],
          message:
            'There is no draft in this chat yet. Write one in a draft block first.'
        }
      }

      const result = applyDraftEdits(current.content, edits)
      if (result.applied > 0) {
        current = {
          ...current,
          version: current.version + 1,
          content: result.content,
          kind: 'edit'
        }
      }

      return {
        applied: result.applied,
        failed: result.failed,
        version: current.version,
        characters: current.content.length,
        ...(result.failed.length > 0 && {
          message:
            'Some edits were skipped because their find text was missing or not unique. Copy the exact text from the current draft and retry only those.'
        })
      }
    }
  })

  return { editDraft }
}
