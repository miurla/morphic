import {
  reachableElements,
  type SpecElement
} from '@/lib/render/linked-cards-markdown'
import { parseSpecBlock } from '@/lib/render/parse-spec-block'
import { stripSpecBlocks } from '@/lib/render/strip-spec-blocks'

import datasetJson from '../datasets/source-cards.json'

import type { RelatedQuestionsInput, SearchFixture } from './dataset'

export type SourceCardsInput = RelatedQuestionsInput

export type SourceCardsExpected = {
  emitsCards: boolean
}

export type SourceCardsCategory = 'listing' | 'other' | 'roundup'

export type SourceCardsMetadata = {
  itemId: string
  category: SourceCardsCategory
  trial: number
}

export type SourceCardsItem = {
  input: SourceCardsInput
  expectedOutput: SourceCardsExpected
  metadata: SourceCardsMetadata
}

type RawItem = {
  id: string
  category: string
  fixture: string
  query: string
}

export function isSourceCardsCategory(
  value: unknown
): value is SourceCardsCategory {
  return value === 'listing' || value === 'other' || value === 'roundup'
}

export function loadSourceCardsDataset({
  trials = 1,
  ids
}: { trials?: number; ids?: string[] } = {}): SourceCardsItem[] {
  const fixtures = datasetJson.fixtures as Record<string, SearchFixture[]>
  const wanted = ids && ids.length > 0 ? new Set(ids) : null
  const items: SourceCardsItem[] = []

  for (const raw of datasetJson.items as RawItem[]) {
    if (wanted && !wanted.has(raw.id)) continue

    const results = fixtures[raw.fixture]
    if (!results) {
      throw new Error(
        `Item "${raw.id}" references unknown fixture "${raw.fixture}"`
      )
    }
    if (!isSourceCardsCategory(raw.category)) {
      throw new Error(`Item "${raw.id}" has unknown category "${raw.category}"`)
    }

    for (let trial = 1; trial <= trials; trial++) {
      items.push({
        input: { query: raw.query, results },
        expectedOutput: { emitsCards: raw.category === 'listing' },
        metadata: { itemId: raw.id, category: raw.category, trial }
      })
    }
  }

  if (wanted) {
    const found = new Set(items.map(item => item.metadata.itemId))
    const missing = [...wanted].filter(id => !found.has(id))
    if (missing.length > 0) {
      throw new Error(`Unknown item id(s): ${missing.join(', ')}`)
    }
  }

  return items
}

export const sourceCardsDatasetDescription = datasetJson.description

/** Results that are not the page of any item the user asked for. */
const NON_ITEM_URLS = new Set<string>(datasetJson.nonItemUrls)

export type SourceCard = {
  title: string
  url: string
}

export type SourceCardsAnalysis = {
  /** A spec block holding a linked Card was present. */
  emitted: boolean
  cards: SourceCard[]
  /** Card URLs that are not a search result URL. */
  ungroundedUrls: string[]
  /**
   * Card URLs that are a search result, but an article or roundup rather than
   * the page of the item the card names.
   */
  misattributedUrls: string[]
  /** The cards satisfy the contract the prompt asks for. */
  wellFormed: boolean
  issues: string[]
  /** The same items also appear as a markdown list outside the block. */
  duplicatedAsList: boolean
}

const SPEC_BLOCK_PATTERN = /```spec\n([\s\S]*?)```/g
const MIN_ITEMS = 2
const MAX_ITEMS = 8

function extractCards(markdown: string): {
  found: boolean
  cards: SourceCard[]
  parseFailures: number
} {
  const pattern = new RegExp(SPEC_BLOCK_PATTERN.source, 'g')
  const cards: SourceCard[] = []
  let found = false
  let parseFailures = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(markdown)) !== null) {
    const source = match[1]
    // A source card is a Card with href; other Cards are not counted.
    if (!source.includes('"Card"') || !source.includes('"href"')) continue
    found = true

    let root: string
    let elements: Record<string, SpecElement>
    try {
      const spec = parseSpecBlock(source)
      root = spec.root
      elements = spec.elements as typeof elements
    } catch {
      parseFailures++
      continue
    }

    // Only cards reachable from the root render, so only those count.
    for (const element of reachableElements(root, elements)) {
      const href = element.props?.href
      if (element.type !== 'Card' || typeof href !== 'string') continue
      // The card's name is its first Text child, per the prompt.
      const title = (element.children ?? [])
        .map(key => elements[key])
        .find(child => child?.type === 'Text')?.props?.text
      cards.push({ title: typeof title === 'string' ? title : '', url: href })
    }
  }

  return { found, cards, parseFailures }
}

function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function analyzeSourceCards(
  markdown: string,
  resultUrls: string[],
  nonItemUrls: ReadonlySet<string> = NON_ITEM_URLS
): SourceCardsAnalysis {
  const { found, cards, parseFailures } = extractCards(markdown)
  const allowed = new Set(resultUrls)
  const ungroundedUrls = cards
    .map(card => card.url)
    .filter(url => !allowed.has(url))
  const misattributedUrls = cards
    .map(card => card.url)
    .filter(url => nonItemUrls.has(url))

  const issues: string[] = []
  if (parseFailures > 0)
    issues.push(`${parseFailures} block(s) failed to parse`)
  if (found && cards.length < MIN_ITEMS) {
    issues.push(`${cards.length} card(s), expected at least ${MIN_ITEMS}`)
  }
  if (cards.length > MAX_ITEMS) {
    issues.push(`${cards.length} cards, expected at most ${MAX_ITEMS}`)
  }
  if (cards.some(card => !card.title?.trim())) issues.push('card without title')
  if (cards.some(card => !isWebUrl(card.url))) issues.push('non-web URL')
  if (new Set(cards.map(card => card.url)).size !== cards.length) {
    issues.push('duplicate URL')
  }

  // A markdown list item naming a card's title means the answer repeated the
  // cards as a list, which the prompt forbids.
  const prose = markdown.replace(new RegExp(SPEC_BLOCK_PATTERN.source, 'g'), '')
  const listLines = stripSpecBlocks(prose)
    .split('\n')
    .filter(line => /^\s*(?:[-*]|\d+\.)\s/.test(line))
    .map(line => line.toLowerCase())
  const repeated = cards.filter(card => {
    const title = card.title?.toLowerCase().trim()
    return title && listLines.some(line => line.includes(title))
  })

  return {
    emitted: found,
    cards,
    ungroundedUrls,
    misattributedUrls,
    wellFormed: found && issues.length === 0,
    issues,
    duplicatedAsList: repeated.length >= MIN_ITEMS
  }
}
