'use client'

import { useMemo } from 'react'

import type { KnowledgeGraphEntity } from '@/lib/entities/knowledge-graph'
import type { NormalizedSource } from '@/lib/sources/source-types'

import { GistCardCarousel } from './gist-card-carousel'
import { GistEntityChips } from './gist-entity-chips'

export type GistCardType = 'summary' | 'context' | 'read-originals'

export interface GistCardData {
  id: string
  type: GistCardType
  eyebrow: string
  title: string
  body: string
  sourceIds: string[]
  mediaUrl?: string
  mediaUrls?: string[]
}

interface GistModuleProps {
  sources: NormalizedSource[]
  entities?: KnowledgeGraphEntity[]
}

const MIN_SOURCES_FOR_GIST = 2
const MAX_GIST_SOURCES = 5

function normalizeClaimText(value?: string) {
  return value?.replace(/\s+/g, ' ').trim().toLowerCase()
}

function sourceClaim(source: NormalizedSource) {
  return normalizeClaimText(source.summary || source.snippet || source.title)
}

function sourceIdentity(source: NormalizedSource) {
  return (
    source.canonicalUrl ||
    source.url ||
    `${source.domain || source.provider || source.kind}:${source.title}`
  ).toLowerCase()
}

function sourceBlurb(source: NormalizedSource) {
  return source.summary || source.snippet || source.title
}

function uniqueSources(sources: NormalizedSource[]) {
  const seenIdentities = new Set<string>()
  const seenClaims = new Set<string>()
  const unique: NormalizedSource[] = []

  for (const source of sources) {
    const identity = sourceIdentity(source)
    const claim = sourceClaim(source)
    if (seenIdentities.has(identity) || (claim && seenClaims.has(claim))) {
      continue
    }

    seenIdentities.add(identity)
    if (claim) {
      seenClaims.add(claim)
    }
    unique.push(source)
  }

  return unique
}

function sentenceFromSources(sources: NormalizedSource[]) {
  return sources
    .map(source => sourceBlurb(source))
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
}

function describeCoverage(sources: NormalizedSource[]) {
  const domains = Array.from(
    new Set(
      sources
        .map(source => source.siteName || source.domain || source.provider)
        .filter(Boolean)
    )
  ).slice(0, 4)
  const sourceKinds = Array.from(new Set(sources.map(source => source.kind)))

  if (domains.length === 0) {
    return `This pass draws from ${sources.length} normalized sources across ${sourceKinds.join(', ')} material.`
  }

  return `This pass draws from ${domains.join(', ')} with ${sourceKinds.join(', ')} source coverage.`
}

export function buildGistCards(sources: NormalizedSource[]): GistCardData[] {
  const unique = uniqueSources(sources).slice(0, MAX_GIST_SOURCES)
  if (unique.length < MIN_SOURCES_FOR_GIST) {
    return []
  }

  const factualSources = unique.slice(0, 2)
  const sourceIds = factualSources.map(source => source.id)
  const mediaUrls = unique
    .map(source => source.imageUrl)
    .filter((url): url is string => Boolean(url))
    .slice(0, 3)

  return [
    {
      id: 'gist-summary',
      type: 'summary',
      eyebrow: 'Gist',
      title: 'Quick summary',
      body: sentenceFromSources(unique),
      sourceIds,
      mediaUrl: mediaUrls[0],
      mediaUrls
    },
    {
      id: 'gist-context',
      type: 'context',
      eyebrow: 'Coverage',
      title: 'What sources are in play',
      body: describeCoverage(unique),
      sourceIds: unique.slice(0, 3).map(source => source.id)
    },
    {
      id: 'gist-read-originals',
      type: 'read-originals',
      eyebrow: 'Originals',
      title: 'Read the originals',
      body: 'Open the underlying sources directly before relying on the synthesized answer.',
      sourceIds: unique
        .filter(source => source.url)
        .slice(0, 4)
        .map(source => source.id)
    }
  ]
}

export function GistModule({ sources, entities = [] }: GistModuleProps) {
  const cards = useMemo(() => buildGistCards(sources), [sources])

  if (cards.length === 0) {
    return null
  }

  return (
    <section className="w-full space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Gist</h2>
        <span className="text-xs text-muted-foreground">
          Source-backed skim
        </span>
      </div>
      <GistEntityChips entities={entities} />
      <GistCardCarousel cards={cards} sources={sources} />
    </section>
  )
}
