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

  for (const result of itemResults) {
    const category = itemCategory(result)
    if (!category) continue
    const analysis = analyzeDraftTurn(turnOutput(result.output), category)
    counts[category]++
    if (category === 'unrelated') {
      if (analysis.calledEdit) hijacked++
      if (analysis.wroteBlock) unrelatedBlocks++
    } else if (category === 'new') {
      if (analysis.correct) newBlocks++
    } else if (analysis.correct) {
      edited++
    }
  }

  return {
    unrelatedCount: counts.unrelated,
    newCount: counts.new,
    editCount: counts.edit,
    hijackRate: rate(hijacked, counts.unrelated),
    unrelatedBlockRate: rate(unrelatedBlocks, counts.unrelated),
    newBlockRate: rate(newBlocks, counts.new),
    editSuccessRate: rate(edited, counts.edit)
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
    }
  ]
}
