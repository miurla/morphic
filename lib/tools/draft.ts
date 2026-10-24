import { tool } from 'ai'
import { z } from 'zod'

import { applyDraftChange, type DraftVersion } from '@/lib/draft/draft'

export const editDraftInputSchema = z.object({
  title: z
    .string()
    .optional()
    .describe(
      'A new title, only for a draft without a top-level heading. When the draft has one, edit the heading instead.'
    ),
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
    .optional()
    .describe('Edits applied in order')
})

/**
 * Edit the chat's current draft in place. The draft is rebuilt from history
 * before the turn, so this only ever sees the version the model was shown.
 */
export function createDraftTools(currentDraft: DraftVersion | null) {
  let current = currentDraft

  const editDraft = tool({
    description: `Make local changes to the current draft (a sentence, a paragraph, the title, one section, a passage the user quoted) with exact find/replace edits.
- Copy each find exactly from <current_draft>. It must appear exactly once; include enough surrounding text to make it unique. If edits are reported as failed, retry only those with corrected find text.
- When the user's message quotes text from the draft (a quoted-context block), that text is what "this" refers to: change only it, and make sure each find contains it.
- For a change across the whole draft, or more than about five places, write a new complete draft block instead.
- Never call this in the same answer that writes a draft block: it only sees the draft from before this answer.
- To rename a draft without a top-level heading, pass the new title; otherwise edit the heading.`,
    inputSchema: editDraftInputSchema,
    execute: async ({ title, edits }) => {
      if (!current) {
        return {
          applied: 0,
          failed: [],
          message:
            'There is no draft in this chat yet. Write one in a draft block first.'
        }
      }

      const result = applyDraftChange(current, { title, edits })
      if (result.applied > 0) {
        current = {
          ...current,
          version: current.version + 1,
          title: result.title,
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
