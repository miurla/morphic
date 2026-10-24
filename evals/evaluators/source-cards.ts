import type { Evaluation, Evaluator, RunEvaluator } from '@langfuse/client'

import {
  analyzeSourceCards,
  isSourceCardsCategory,
  type SourceCardsExpected,
  type SourceCardsInput,
  type SourceCardsMetadata
} from '../lib/source-cards'

type ItemResult = {
  input?: unknown
  output?: unknown
  metadata?: unknown
  item?: { input?: unknown; metadata?: unknown }
}

export type SourceCardsSummary = {
  listingCount: number
  otherCount: number
  roundupCount: number
  emittedCount: number
  /** Share of listing answers that carried cards. */
  emissionRate: number
  /** Share of other answers that carried cards anyway. */
  misuseRate: number
  /** Share of roundup answers that carried cards, which can only link articles. */
  roundupMisuseRate: number
  /** Share of emitted answers whose cards satisfy the contract. */
  wellFormedRate: number
  /** Share of all emitted cards whose URL is a search result URL. */
  groundedRate: number
  /** Share of all emitted cards linking an article instead of the item's page. */
  misattributedRate: number
  /** Share of emitted answers that also repeated the cards as a list. */
  duplicatedRate: number
  cardCount: number
}

function answerText(output: unknown): string {
  if (typeof output === 'string') return output
  if (output && typeof output === 'object' && 'text' in output) {
    const text = (output as { text?: unknown }).text
    if (typeof text === 'string') return text
  }
  return ''
}

function resultUrls(input: unknown): string[] {
  const results = (input as SourceCardsInput | undefined)?.results ?? []
  return results.map(result => result.url)
}

function itemCategory(result: ItemResult) {
  const metadata = (result.metadata ?? result.item?.metadata) as
    | { category?: unknown }
    | undefined
  const category = metadata?.category
  return isSourceCardsCategory(category) ? category : undefined
}

export const sourceCardsEvaluator: Evaluator<
  SourceCardsInput,
  SourceCardsExpected,
  SourceCardsMetadata
> = async ({ input, output, expectedOutput }) => {
  const analysis = analyzeSourceCards(answerText(output), resultUrls(input))
  const expected = expectedOutput?.emitsCards ?? true

  const evaluations: Evaluation[] = [
    {
      name: 'source_cards_emitted',
      value: analysis.emitted ? 1 : 0,
      dataType: 'BOOLEAN',
      comment: analysis.emitted
        ? `${analysis.cards.length} card(s)`
        : 'no cards'
    },
    {
      name: 'source_cards_matches_expectation',
      value: analysis.emitted === expected ? 1 : 0,
      dataType: 'BOOLEAN'
    }
  ]

  // Contract and grounding are undefined when nothing was emitted.
  if (analysis.emitted) {
    evaluations.push(
      {
        name: 'source_cards_wellformed',
        value: analysis.wellFormed ? 1 : 0,
        dataType: 'BOOLEAN',
        comment: analysis.wellFormed ? 'ok' : analysis.issues.join('; ')
      },
      {
        name: 'source_cards_grounded',
        value: analysis.ungroundedUrls.length === 0 ? 1 : 0,
        dataType: 'BOOLEAN',
        comment:
          analysis.ungroundedUrls.length === 0
            ? 'all URLs from search results'
            : `ungrounded: ${analysis.ungroundedUrls.join(', ')}`
      },
      {
        name: 'source_cards_item_pages',
        value: analysis.misattributedUrls.length === 0 ? 1 : 0,
        dataType: 'BOOLEAN',
        comment:
          analysis.misattributedUrls.length === 0
            ? 'every card links an item page'
            : `article links: ${analysis.misattributedUrls.join(', ')}`
      }
    )
  }

  return evaluations
}

export function summarizeSourceCards(
  itemResults: ItemResult[]
): SourceCardsSummary {
  let listingCount = 0
  let otherCount = 0
  let roundupCount = 0
  let listingEmitted = 0
  let otherEmitted = 0
  let roundupEmitted = 0
  let misattributedCards = 0
  let emittedCount = 0
  let wellFormed = 0
  let duplicated = 0
  let cardCount = 0
  let groundedCards = 0

  for (const result of itemResults) {
    const analysis = analyzeSourceCards(
      answerText(result.output),
      resultUrls(result.input ?? result.item?.input)
    )
    const category = itemCategory(result)

    if (analysis.emitted) {
      emittedCount++
      if (analysis.wellFormed) wellFormed++
      if (analysis.duplicatedAsList) duplicated++
      cardCount += analysis.cards.length
      groundedCards += analysis.cards.length - analysis.ungroundedUrls.length
      misattributedCards += analysis.misattributedUrls.length
    }

    if (category === 'listing') {
      listingCount++
      if (analysis.emitted) listingEmitted++
    } else if (category === 'other') {
      otherCount++
      if (analysis.emitted) otherEmitted++
    } else if (category === 'roundup') {
      roundupCount++
      if (analysis.emitted) roundupEmitted++
    }
  }

  const rate = (n: number, d: number) => (d === 0 ? 0 : n / d)

  return {
    listingCount,
    otherCount,
    roundupCount,
    emittedCount,
    emissionRate: rate(listingEmitted, listingCount),
    misuseRate: rate(otherEmitted, otherCount),
    roundupMisuseRate: rate(roundupEmitted, roundupCount),
    wellFormedRate: rate(wellFormed, emittedCount),
    groundedRate: rate(groundedCards, cardCount),
    misattributedRate: rate(misattributedCards, cardCount),
    duplicatedRate: rate(duplicated, emittedCount),
    cardCount
  }
}

export const sourceCardsRunEvaluator: RunEvaluator<
  SourceCardsInput,
  SourceCardsExpected,
  SourceCardsMetadata
> = async ({ itemResults }) => {
  const summary = summarizeSourceCards(itemResults as ItemResult[])

  return [
    {
      name: 'emission_rate',
      value: summary.emissionRate,
      dataType: 'NUMERIC',
      comment: `listing items: ${summary.listingCount}`
    },
    {
      name: 'misuse_rate',
      value: summary.misuseRate,
      dataType: 'NUMERIC',
      comment: `other items: ${summary.otherCount}`
    },
    {
      name: 'wellformed_rate',
      value: summary.wellFormedRate,
      dataType: 'NUMERIC'
    },
    {
      name: 'grounded_rate',
      value: summary.groundedRate,
      dataType: 'NUMERIC',
      comment: `cards: ${summary.cardCount}`
    },
    {
      name: 'roundup_misuse_rate',
      value: summary.roundupMisuseRate,
      dataType: 'NUMERIC',
      comment: `roundup items: ${summary.roundupCount}`
    },
    {
      name: 'misattributed_rate',
      value: summary.misattributedRate,
      dataType: 'NUMERIC'
    },
    {
      name: 'duplicated_rate',
      value: summary.duplicatedRate,
      dataType: 'NUMERIC'
    }
  ]
}
