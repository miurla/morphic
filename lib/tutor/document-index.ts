import { getTutorDocumentFormat } from './document-formats'

/** Parsing semantics are part of index identity even when the raw bytes match. */
export function buildDocumentIndexKey(
  parseVersion: string,
  embeddingModel: string,
  filename?: string
) {
  const base = `${parseVersion}:${embeddingModel}`
  const format = filename ? getTutorDocumentFormat(filename) : 'pdf'
  // Preserve the identity of documents uploaded before multi-format support.
  return !format || format === 'pdf' ? base : `${base}:${format}-v1`
}
