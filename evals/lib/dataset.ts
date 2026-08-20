import datasetJson from '../datasets/related-questions.json'

export type SearchFixture = {
  title: string
  url: string
  content: string
}

export type RelatedQuestionsInput = {
  query: string
  results: SearchFixture[]
}

export type RelatedQuestionsExpected = {
  emitsRelated: boolean
}

export type RelatedQuestionsMetadata = {
  itemId: string
  category: 'substantive' | 'trivial'
  trial: number
}

export type RelatedQuestionsItem = {
  input: RelatedQuestionsInput
  expectedOutput: RelatedQuestionsExpected
  metadata: RelatedQuestionsMetadata
}

type RawItem = {
  id: string
  category: string
  fixture: string
  query: string
}

function isCategory(value: string): value is 'substantive' | 'trivial' {
  return value === 'substantive' || value === 'trivial'
}

/**
 * Expand the committed dataset into experiment items.
 *
 * Emission is probabilistic, so a single generation per query measures almost
 * nothing. Each query is repeated `trials` times as separate items, which keeps
 * one item equal to one generation in Langfuse while letting the run-level
 * evaluator compute a rate.
 */
export function loadRelatedQuestionsDataset({
  trials = 1,
  ids
}: { trials?: number; ids?: string[] } = {}): RelatedQuestionsItem[] {
  const fixtures = datasetJson.fixtures as Record<string, SearchFixture[]>
  const items: RelatedQuestionsItem[] = []

  const wanted = ids && ids.length > 0 ? new Set(ids) : null

  for (const raw of datasetJson.items as RawItem[]) {
    if (wanted && !wanted.has(raw.id)) continue

    const results = fixtures[raw.fixture]
    if (!results) {
      throw new Error(
        `Item "${raw.id}" references unknown fixture "${raw.fixture}"`
      )
    }
    if (!isCategory(raw.category)) {
      throw new Error(`Item "${raw.id}" has unknown category "${raw.category}"`)
    }

    for (let trial = 1; trial <= trials; trial++) {
      items.push({
        input: { query: raw.query, results },
        expectedOutput: { emitsRelated: raw.category === 'substantive' },
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

export const datasetDescription = datasetJson.description
