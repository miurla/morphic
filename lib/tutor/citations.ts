import type { RetrievedChunk, SourceCitation } from './types'

export class CitationValidationError extends Error {
  readonly code = 'INVALID_CITATION'
  constructor() {
    super(
      'The generated response contains an unsupported source reference. Please try again.'
    )
    this.name = 'CitationValidationError'
  }
}

/** Structural validation is separate from whether evidence supports a claim. */
export function assertCitationIds(
  sourceIds: string[],
  evidence: Pick<RetrievedChunk, 'id'>[],
  requireSource = true
): void {
  const available = new Set(evidence.map(chunk => chunk.id))
  if (
    (requireSource && !sourceIds.length) ||
    sourceIds.some(id => !available.has(id))
  ) {
    throw new CitationValidationError()
  }
}

export function toSourceCitation(chunk: RetrievedChunk): SourceCitation {
  return {
    id: chunk.id,
    documentId: chunk.documentId,
    filename: chunk.filename,
    // Quotes come exclusively from persisted extracted text, never the model.
    quote: chunk.text,
    regions: chunk.regions
  }
}

export function citationsForIds(
  sourceIds: string[],
  evidence: RetrievedChunk[]
): SourceCitation[] {
  assertCitationIds(sourceIds, evidence)
  const byId = new Map(evidence.map(chunk => [chunk.id, chunk]))
  return [...new Set(sourceIds)].map(id => toSourceCitation(byId.get(id)!))
}
