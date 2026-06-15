import type { SearchResults } from '@/lib/types'
import type { FeedSearchResults } from '@/lib/types/feed'
import type { KnowledgeGraphEntity } from '@/lib/entities/knowledge-graph'

import {
  normalizeFeedResults,
  normalizeFetchResults,
  normalizeSearchResults
} from './normalize-source'
import { dedupeNormalizedSources } from './source-ranking'
import type { NormalizedSource } from './source-types'

type SourceToolPart = {
  type?: string
  state?: string
  input?: Record<string, any>
  output?: any
}

function isCompleteToolPart(part: SourceToolPart): boolean {
  return part.state === 'output-available' && part.output?.state === 'complete'
}

export function collectSourcesFromMessageParts(
  parts: SourceToolPart[] = []
): NormalizedSource[] {
  const sources: NormalizedSource[] = []

  for (const part of parts) {
    if (!isCompleteToolPart(part)) {
      continue
    }

    if (part.type === 'tool-search') {
      sources.push(
        ...normalizeSearchResults(part.output as SearchResults, {
          retrievalQuery: part.input?.query ?? part.output.query
        })
      )
      continue
    }

    if (part.type === 'tool-fetch') {
      sources.push(
        ...normalizeFetchResults(part.output as SearchResults, {
          retrievalQuery: part.input?.url ?? part.output.query
        })
      )
      continue
    }

    if (part.type === 'tool-feedSearch') {
      sources.push(...normalizeFeedResults(part.output as FeedSearchResults))
    }
  }

  return dedupeNormalizedSources(sources)
}

function entityKey(entity: KnowledgeGraphEntity): string {
  return (
    entity.wikidataId ||
    entity.dbpediaUri ||
    entity.wikidataUrl ||
    entity.dbpediaUrl ||
    entity.label.toLowerCase()
  )
}

export function collectEntitiesFromMessageParts(
  parts: SourceToolPart[] = []
): KnowledgeGraphEntity[] {
  const entities: KnowledgeGraphEntity[] = []

  for (const part of parts) {
    if (!isCompleteToolPart(part)) {
      continue
    }

    const outputEntities = Array.isArray(part.output?.entities)
      ? part.output.entities
      : []
    entities.push(...(outputEntities as KnowledgeGraphEntity[]))
  }

  const seen = new Set<string>()
  return entities.filter(entity => {
    const key = entityKey(entity)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
