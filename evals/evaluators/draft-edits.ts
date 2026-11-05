import type { Evaluation, Evaluator, RunEvaluator } from '@langfuse/client'

import {
  analyzeDraftTurn,
  type DraftEditsCategory,
  type DraftEditsExpected,
  type DraftEditsInput,
  type DraftEditsMetadata,
  type DraftTurnOutput,
  isDraftEditsCategory
} from '../lib/draft-edits'

type ItemResult = {
  output?: unknown
  metadata?: unknown
  item?: { metadata?: unknown }
}

export type DraftEditsSummary = {
  unrelatedCount: number
  newCount: number
  editCount: number
  /** Share of unrelated requests where editDraft was called. */
  hijackRate: number
  /** Share of unrelated requests answered with a new draft block. */
  unrelatedBlockRate: number
  /** Share of new-piece requests answered with a new block and no edit. */
  newBlockRate: number
  /** Share of change requests that changed the draft or rewrote it. */
  editSuccessRate: number
  /** Answers that wrote or changed the draft. */
  draftAnswerCount: number
  /** Share of those answers that ended with follow-up suggestions. */
  draftSuggestionRate: number
  /** Share of those answers whose suggestions are titled "Revise". */
  revisionSuggestionRate: number
  /** Share of emitted suggestion blocks that are well formed. */
  suggestionWellFormedRate: number
  /** Share of unrelated requests answered with revision suggestions. */
  unrelatedRevisionRate: number
}

function turnOutput(output: unknown): DraftTurnOutput {
  const value = output as Partial<DraftTurnOutput> | undefined
  return {
    text: typeof value?.text === 'string' ? value.text : '',
    editCalls: Array.isArray(value?.editCalls) ? value.editCalls : []
  }
}

function itemCategory(result: ItemResult): DraftEditsCategory | undefined {
  const metadata = (result.metadata ?? result.item?.metadata) as
    | { category?: unknown }
    | undefined
  return isDraftEditsCategory(metadata?.category)
    ? metadata.category
    : undefined
}

export const draftEditsEvaluator: Evaluator<
  DraftEditsInput,
  DraftEditsExpected,
  DraftEditsMetadata
> = async ({ output, expectedOutput }) => {
  const category = expectedOutput?.category
  if (!category) return []
  const analysis = analyzeDraftTurn(turnOutput(output), category)

  const evaluations: Evaluation[] = [
    {
      name: 'draft_turn_correct',
      value: analysis.correct ? 1 : 0,
      dataType: 'BOOLEAN',
      comment: category
    },
    {
      name: 'draft_edit_called',
      value: analysis.calledEdit ? 1 : 0,
      dataType: 'BOOLEAN'
    },
    {
      name: 'draft_block_written',
      value: analysis.wroteBlock ? 1 : 0,
      dataType: 'BOOLEAN'
    },
    {
      name: 'draft_revisions_suggested',
      value: analysis.suggestedRevisions ? 1 : 0,
      dataType: 'BOOLEAN'
    }
  ]
  return evaluations
}

function rate(hits: number, total: number) {
  return total === 0 ? 0 : hits / total
}

export function summarizeDraftEdits(
  itemResults: ItemResult[]
): DraftEditsSummary {
  const counts = { unrelated: 0, new: 0, edit: 0 }
  let hijacked = 0
  let unrelatedBlocks = 0
  let newBlocks = 0
  let edited = 0
  let draftAnswers = 0
  let suggested = 0
  let revisions = 0
  let emitted = 0
  let wellFormed = 0
  let unrelatedSuggested = 0

  for (const result of itemResults) {
    const category = itemCategory(result)
    if (!category) continue
    const analysis = analyzeDraftTurn(turnOutput(result.output), category)
    counts[category]++
    if (analysis.suggested) {
      emitted++
      if (analysis.suggestionsWellFormed) wellFormed++
    }
    if (category === 'unrelated') {
      if (analysis.calledEdit) hijacked++
      if (analysis.wroteBlock) unrelatedBlocks++
      if (analysis.suggestedRevisions) unrelatedSuggested++
    } else {
      if (category === 'new' && analysis.correct) newBlocks++
      if (category === 'edit' && analysis.correct) edited++
      if (analysis.wroteBlock || analysis.changedDraft) {
        draftAnswers++
        if (analysis.suggested) suggested++
        if (analysis.suggestedRevisions) revisions++
      }
    }
  }

  return {
    unrelatedCount: counts.unrelated,
    newCount: counts.new,
    editCount: counts.edit,
    hijackRate: rate(hijacked, counts.unrelated),
    unrelatedBlockRate: rate(unrelatedBlocks, counts.unrelated),
    newBlockRate: rate(newBlocks, counts.new),
    editSuccessRate: rate(edited, counts.edit),
    draftAnswerCount: draftAnswers,
    draftSuggestionRate: rate(suggested, draftAnswers),
    revisionSuggestionRate: rate(revisions, draftAnswers),
    suggestionWellFormedRate: rate(wellFormed, emitted),
    unrelatedRevisionRate: rate(unrelatedSuggested, counts.unrelated)
  }
}

export const draftEditsRunEvaluator: RunEvaluator<
  DraftEditsInput,
  DraftEditsExpected,
  DraftEditsMetadata
> = async ({ itemResults }) => {
  const summary = summarizeDraftEdits(itemResults)
  return [
    {
      name: 'hijackRate',
      value: summary.hijackRate,
      comment: `n=${summary.unrelatedCount}`
    },
    {
      name: 'unrelatedBlockRate',
      value: summary.unrelatedBlockRate,
      comment: `n=${summary.unrelatedCount}`
    },
    {
      name: 'newBlockRate',
      value: summary.newBlockRate,
      comment: `n=${summary.newCount}`
    },
    {
      name: 'editSuccessRate',
      value: summary.editSuccessRate,
      comment: `n=${summary.editCount}`
    },
    {
      name: 'draftSuggestionRate',
      value: summary.draftSuggestionRate,
      comment: `n=${summary.draftAnswerCount}`
    },
    {
      name: 'revisionSuggestionRate',
      value: summary.revisionSuggestionRate,
      comment: `n=${summary.draftAnswerCount}`
    },
    {
      name: 'suggestionWellFormedRate',
      value: summary.suggestionWellFormedRate
    },
    {
      name: 'unrelatedRevisionRate',
      value: summary.unrelatedRevisionRate,
      comment: `n=${summary.unrelatedCount}`
    }
  ]
}
