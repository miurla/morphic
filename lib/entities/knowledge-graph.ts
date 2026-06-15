import type { SearchResultItem, SearchResults } from '@/lib/types'

export interface KnowledgeGraphEntity {
  label: string
  description?: string
  matchedText: string
  wikidataId?: string
  wikidataUrl?: string
  dbpediaUri?: string
  dbpediaUrl?: string
  source: 'wikidata' | 'dbpedia' | 'both'
  confidence: number
}

const ENTITY_LOOKUP_TIMEOUT_MS = 2500
const MAX_ENTITY_QUERIES = 4
const MAX_ENTITY_RESULTS_PER_QUERY = 2
const USER_AGENT =
  process.env.KNOWLEDGE_GRAPH_USER_AGENT ||
  'Morphic/1.0 (source-first search entity enrichment)'

const QUERY_PREFIXES =
  /^(tell me about|what is|what's|who is|who's|where is|visit|explain|overview of|guide to)\s+/i
const TITLE_SUFFIXES =
  /\s+[-|–—]\s+(wikipedia|wikivoyage|tripadvisor|official.*|travel guide|guide|ultimate guide).*$/i

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeEntityQuery(value: string): string | undefined {
  const normalized = normalizeWhitespace(
    value
      .replace(QUERY_PREFIXES, '')
      .replace(TITLE_SUFFIXES, '')
      .replace(/[()[\]{}"]/g, ' ')
      .replace(/\b(site|official website|homepage)\b/gi, ' ')
  )

  if (normalized.length < 3 || normalized.length > 96) {
    return undefined
  }

  return normalized
}

function getEntityQueryCandidates(
  query: string,
  results: SearchResultItem[]
): string[] {
  const candidates = [query, ...results.slice(0, 5).map(result => result.title)]
    .map(candidate => normalizeEntityQuery(candidate))
    .filter((candidate): candidate is string => Boolean(candidate))

  const seen = new Set<string>()
  const unique: string[] = []
  for (const candidate of candidates) {
    const key = candidate.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    unique.push(candidate)
  }

  return unique.slice(0, MAX_ENTITY_QUERIES)
}

async function fetchJson(
  url: string,
  headers: HeadersInit = {}
): Promise<Record<string, any> | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        ...headers
      },
      signal: AbortSignal.timeout(ENTITY_LOOKUP_TIMEOUT_MS)
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as Record<string, any>
  } catch {
    return null
  }
}

async function searchWikidata(query: string): Promise<KnowledgeGraphEntity[]> {
  const url = new URL('https://www.wikidata.org/w/api.php')
  url.searchParams.set('action', 'wbsearchentities')
  url.searchParams.set('search', query)
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', String(MAX_ENTITY_RESULTS_PER_QUERY))

  const json = await fetchJson(url.toString())
  const hits = Array.isArray(json?.search) ? json.search : []

  const entities: KnowledgeGraphEntity[] = []

  for (const hit of hits) {
    const id = typeof hit?.id === 'string' ? hit.id : undefined
    const label = normalizeWhitespace(String(hit?.label ?? ''))
    if (!id || !label) {
      continue
    }

    entities.push({
      label,
      description:
        normalizeWhitespace(String(hit?.description ?? '')) || undefined,
      matchedText: query,
      wikidataId: id,
      wikidataUrl: `https://www.wikidata.org/wiki/${encodeURIComponent(id)}`,
      source: 'wikidata' as const,
      confidence: Number(hit?.score ?? 0.8) || 0.8
    })
  }

  return entities
}

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined
  }
  return typeof value === 'string' ? value : undefined
}

async function searchDbpedia(query: string): Promise<KnowledgeGraphEntity[]> {
  const url = new URL('https://lookup.dbpedia.org/api/search')
  url.searchParams.set('query', query)
  url.searchParams.set('format', 'JSON')
  url.searchParams.set('maxResults', String(MAX_ENTITY_RESULTS_PER_QUERY))

  const json = await fetchJson(url.toString())
  const docs = Array.isArray(json?.docs)
    ? json.docs
    : Array.isArray(json?.results)
      ? json.results
      : []

  const entities: KnowledgeGraphEntity[] = []

  for (const doc of docs) {
    const uri = firstString(doc?.resource) || firstString(doc?.uri)
    const label =
      normalizeWhitespace(
        firstString(doc?.label) || String(doc?.label ?? '')
      ) || (uri ? decodeURIComponent(uri.split('/').pop() || '') : '')
    if (!uri || !label) {
      continue
    }

    const description =
      normalizeWhitespace(
        firstString(doc?.comment) || firstString(doc?.description) || ''
      ) || undefined

    entities.push({
      label,
      description,
      matchedText: query,
      dbpediaUri: uri,
      dbpediaUrl: uri.replace(/^http:/, 'https:'),
      source: 'dbpedia' as const,
      confidence: Number(firstString(doc?.score) ?? doc?.score ?? 0.65) || 0.65
    })
  }

  return entities
}

function entityLabelKey(entity: KnowledgeGraphEntity): string {
  return entity.label.toLowerCase().replace(/\s+/g, ' ').trim()
}

function entityKey(entity: KnowledgeGraphEntity): string {
  return (
    entity.wikidataId ||
    entity.dbpediaUri ||
    entity.label.toLowerCase().replace(/\s+/g, ' ')
  )
}

function mergeEntities(
  entities: KnowledgeGraphEntity[]
): KnowledgeGraphEntity[] {
  const byKey = new Map<string, KnowledgeGraphEntity>()
  const keyByLabel = new Map<string, string>()

  for (const entity of entities) {
    const labelKey = entityLabelKey(entity)
    const key = keyByLabel.get(labelKey) || entityKey(entity)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, entity)
      keyByLabel.set(labelKey, key)
      continue
    }

    byKey.set(key, {
      ...existing,
      description: existing.description || entity.description,
      wikidataId: existing.wikidataId || entity.wikidataId,
      wikidataUrl: existing.wikidataUrl || entity.wikidataUrl,
      dbpediaUri: existing.dbpediaUri || entity.dbpediaUri,
      dbpediaUrl: existing.dbpediaUrl || entity.dbpediaUrl,
      source:
        existing.source === entity.source ? existing.source : ('both' as const),
      confidence: Math.max(existing.confidence, entity.confidence)
    })
  }

  return [...byKey.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)
}

export async function lookupKnowledgeGraphEntities(
  query: string,
  results: SearchResultItem[] = []
): Promise<KnowledgeGraphEntity[]> {
  const candidates = getEntityQueryCandidates(query, results)
  if (candidates.length === 0) {
    return []
  }

  const batches = await Promise.all(
    candidates.map(async candidate => {
      const [wikidata, dbpedia] = await Promise.all([
        searchWikidata(candidate),
        searchDbpedia(candidate)
      ])
      return [...wikidata, ...dbpedia]
    })
  )

  return mergeEntities(batches.flat())
}

export async function enrichSearchResultsWithKnowledgeGraph(
  searchResult: SearchResults
): Promise<SearchResults> {
  const entities = await lookupKnowledgeGraphEntities(
    searchResult.query,
    searchResult.results
  )

  if (entities.length === 0) {
    return searchResult
  }

  return {
    ...searchResult,
    entities
  }
}
