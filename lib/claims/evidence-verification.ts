import type { FactCheckSearchResults } from '@/lib/tools/factcheck'
import type { SearchResultItem } from '@/lib/types'

export type ClaimSupportStatus =
  | 'supported'
  | 'partially_supported'
  | 'contradicted'
  | 'uncited'
  | 'unavailable'

export type ClaimEvidenceSupportType =
  | 'supports'
  | 'partially_supports'
  | 'contradicts'
  | 'background'

export interface ClaimEvidenceSource {
  sourceId?: string
  sourceTitle?: string
  sourceUrl?: string
  quote?: string
  supportType: ClaimEvidenceSupportType
  evidenceType?: 'citation' | 'fact_check_review'
}

export interface VerifiedClaim {
  id: string
  text: string
  supportStatus: ClaimSupportStatus
  confidence?: number
  evidence: ClaimEvidenceSource[]
}

export interface ClaimVerificationResult {
  status: 'checked' | 'failed'
  checkedAt: string
  claims: VerifiedClaim[]
  error?: string
}

export interface VerifyAnswerClaimsInput {
  answer: string
  citationMaps: Record<string, Record<number, SearchResultItem>>
  factCheckResults?: FactCheckSearchResults[]
  checkedAt?: Date
}

interface ClaimCandidate {
  text: string
  citationRefs: Array<{
    toolCallId: string
    citationNumber: number
  }>
}

const CITATION_PATTERN = /\[\s*(\d+)\s*\]\(#([^)]+)\)/g
const MIN_SUPPORTED_OVERLAP = 0.46
const MIN_PARTIAL_OVERLAP = 0.22
const MIN_FACT_CHECK_OVERLAP = 0.56
const NEGATION_TERMS = new Set([
  'did not',
  'does not',
  'do not',
  'not',
  'never',
  'no',
  'false',
  'denied',
  'without'
])
const STOP_WORDS = new Set([
  'about',
  'after',
  'also',
  'from',
  'have',
  'into',
  'more',
  'that',
  'the',
  'their',
  'this',
  'with'
])

function stableClaimId(text: string, index: number) {
  let hash = 2166136261
  for (const char of `${index}:${text}`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `claim-${(hash >>> 0).toString(36)}`
}

function normalizeClaimText(value: string) {
  return value.replace(CITATION_PATTERN, '').replace(/\s+/g, ' ').trim()
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(token =>
      token.replace(/(ing|edly|edly|ed|es|s)$/i, '').replace(/-+/g, '')
    )
    .filter(token => token.length >= 3 && !STOP_WORDS.has(token))
}

function hasNegation(value: string) {
  const normalized = value.toLowerCase()
  return Array.from(NEGATION_TERMS).some(term =>
    new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized)
  )
}

function tokenOverlap(left: string, right: string) {
  const leftTokens = new Set(tokenize(left))
  const rightTokens = new Set(tokenize(right))
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0
  }

  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1
    }
  }

  return overlap / leftTokens.size
}

function sourceText(source: SearchResultItem) {
  return [source.title, source.content].filter(Boolean).join(' ')
}

function quoteForSource(source: SearchResultItem) {
  const text = source.content || source.title
  return text?.replace(/\s+/g, ' ').trim().slice(0, 280)
}

function extractClaimCandidates(answer: string): ClaimCandidate[] {
  const segments = answer.match(
    /[^.!?]+[.!?](?:\s*\[\s*\d+\s*\]\(#[^)]+\))*|[^.!?]+$/g
  )

  return (segments ?? [])
    .map(segment => segment.trim())
    .filter(Boolean)
    .map(segment => {
      const citationRefs: ClaimCandidate['citationRefs'] = []
      for (const match of segment.matchAll(CITATION_PATTERN)) {
        citationRefs.push({
          citationNumber: Number.parseInt(match[1], 10),
          toolCallId: match[2]
        })
      }

      return {
        text: normalizeClaimText(segment),
        citationRefs
      }
    })
    .filter(candidate => candidate.text.length > 0)
}

function resolveCitedSources(
  candidate: ClaimCandidate,
  citationMaps: VerifyAnswerClaimsInput['citationMaps']
) {
  return candidate.citationRefs
    .map(ref => citationMaps[ref.toolCallId]?.[ref.citationNumber])
    .filter((source): source is SearchResultItem => Boolean(source))
}

function classifyEvidence(
  claimText: string,
  source: SearchResultItem
): {
  confidence: number
  supportType: ClaimEvidenceSupportType
  status: ClaimSupportStatus
} {
  const text = sourceText(source)
  const confidence = tokenOverlap(claimText, text)
  const negationMismatch = hasNegation(claimText) !== hasNegation(text)

  if (confidence >= MIN_PARTIAL_OVERLAP && negationMismatch) {
    return {
      confidence,
      status: 'contradicted',
      supportType: 'contradicts'
    }
  }

  if (confidence >= MIN_SUPPORTED_OVERLAP) {
    return {
      confidence,
      status: 'supported',
      supportType: 'supports'
    }
  }

  if (confidence >= MIN_PARTIAL_OVERLAP) {
    return {
      confidence,
      status: 'partially_supported',
      supportType: 'partially_supports'
    }
  }

  return {
    confidence,
    status: 'unavailable',
    supportType: 'background'
  }
}

function classifyFactCheckRating(textualRating: string): {
  supportType: ClaimEvidenceSupportType
  status: ClaimSupportStatus
} | null {
  const rating = textualRating.toLowerCase()

  if (
    /\b(true|correct|accurate|verified)\b/.test(rating) &&
    !/\bnot true|false|misleading|incorrect\b/.test(rating)
  ) {
    return {
      status: 'supported',
      supportType: 'supports'
    }
  }

  if (/\b(false|misleading|incorrect|pants|fabricated|fake)\b/.test(rating)) {
    return {
      status: 'contradicted',
      supportType: 'contradicts'
    }
  }

  if (/\b(partly|partially|mixed|half|mostly)\b/.test(rating)) {
    return {
      status: 'partially_supported',
      supportType: 'partially_supports'
    }
  }

  return null
}

function factCheckEvidenceForClaim(
  claimText: string,
  factCheckResults: FactCheckSearchResults[] = []
) {
  const evidence: Array<{
    confidence: number
    status: ClaimSupportStatus
    evidence: ClaimEvidenceSource
  }> = []

  for (const result of factCheckResults) {
    for (const claim of result.claims ?? []) {
      const overlap = tokenOverlap(claimText, claim.text)
      if (overlap < MIN_FACT_CHECK_OVERLAP) {
        continue
      }

      for (const review of claim.claimReview ?? []) {
        const classification = classifyFactCheckRating(review.textualRating)
        if (!classification || !review.url) {
          continue
        }

        const publisher = review.publisher?.name || 'Fact check'
        const title = review.title
          ? `${publisher}: ${review.title}`
          : `${publisher}: ${claim.text}`

        evidence.push({
          confidence: overlap,
          status: classification.status,
          evidence: {
            sourceTitle: title,
            sourceUrl: review.url,
            quote: review.textualRating,
            supportType: classification.supportType,
            evidenceType: 'fact_check_review'
          }
        })
      }
    }
  }

  return evidence
}

function strongestStatus(
  classified: Array<ReturnType<typeof classifyEvidence>>
): ClaimSupportStatus {
  if (classified.some(item => item.status === 'contradicted')) {
    return 'contradicted'
  }
  if (classified.some(item => item.status === 'supported')) {
    return 'supported'
  }
  if (classified.some(item => item.status === 'partially_supported')) {
    return 'partially_supported'
  }
  return 'unavailable'
}

export function verifyAnswerClaims({
  answer,
  citationMaps,
  factCheckResults = [],
  checkedAt = new Date()
}: VerifyAnswerClaimsInput): ClaimVerificationResult {
  try {
    if (typeof answer !== 'string') {
      throw new Error('Answer must be a string.')
    }

    const claims = extractClaimCandidates(answer).map((candidate, index) => {
      const factCheckEvidence = factCheckEvidenceForClaim(
        candidate.text,
        factCheckResults
      )

      if (candidate.citationRefs.length === 0) {
        if (factCheckEvidence.length > 0) {
          const supportStatus = strongestStatus(
            factCheckEvidence.map(item => ({
              confidence: item.confidence,
              status: item.status,
              supportType: item.evidence.supportType
            }))
          )
          return {
            id: stableClaimId(candidate.text, index),
            text: candidate.text,
            supportStatus,
            confidence: Math.max(
              ...factCheckEvidence.map(item => item.confidence)
            ),
            evidence: factCheckEvidence.map(item => item.evidence)
          }
        }

        return {
          id: stableClaimId(candidate.text, index),
          text: candidate.text,
          supportStatus: 'uncited' as const,
          confidence: 0,
          evidence: []
        }
      }

      const sources = resolveCitedSources(candidate, citationMaps)
      if (sources.length === 0) {
        return {
          id: stableClaimId(candidate.text, index),
          text: candidate.text,
          supportStatus: 'unavailable' as const,
          confidence: 0,
          evidence: []
        }
      }

      const classified = sources.map(source =>
        classifyEvidence(candidate.text, source)
      )
      const factCheckClassified = factCheckEvidence.map(item => ({
        confidence: item.confidence,
        status: item.status,
        supportType: item.evidence.supportType
      }))
      const supportStatus = strongestStatus([
        ...classified,
        ...factCheckClassified
      ])
      const confidence = Math.max(
        ...classified.map(item => item.confidence),
        ...factCheckEvidence.map(item => item.confidence),
        0
      )
      const evidence = sources.map((source, sourceIndex) => ({
        sourceTitle: source.title,
        sourceUrl: source.url,
        quote: quoteForSource(source),
        supportType: classified[sourceIndex].supportType,
        evidenceType: 'citation' as const
      }))

      return {
        id: stableClaimId(candidate.text, index),
        text: candidate.text,
        supportStatus,
        confidence,
        evidence: [...evidence, ...factCheckEvidence.map(item => item.evidence)]
      }
    })

    return {
      status: 'checked',
      checkedAt: checkedAt.toISOString(),
      claims
    }
  } catch (error) {
    return {
      status: 'failed',
      checkedAt: checkedAt.toISOString(),
      claims: [],
      error:
        error instanceof Error ? error.message : 'Claim verification failed.'
    }
  }
}
