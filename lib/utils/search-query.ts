/**
 * Shared query bound for history search, applied on the client before a
 * query goes into a GET URL and again in the database actions so every
 * result group matches the same effective query.
 *
 * Content/reasoning tokens expand into an OR group of their proper
 * prefixes, so the generated tsquery grows quadratically with token
 * length; bounding the query keeps it (and Postgres' parse of it) small no
 * matter the input. Client-side bounding also keeps a pasted passage from
 * exceeding the deployment's request-target limit before the server bound
 * can take effect. Truncation happens at the last whitespace before the
 * cap so a partially sliced token cannot act as a broad prefix match.
 */
export const MAX_QUERY_LENGTH = 200

// Slicing can split a surrogate pair, and lone surrogates are rejected by
// encodeURIComponent (URIError) and by Postgres' UTF-8 validation. Strip
// them so the normalized query is always encodable.
function stripLoneSurrogates(value: string): string {
  return value.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ''
  )
}

export function normalizeSearchQuery(query: string): string {
  const trimmed = query.trim()
  if (trimmed.length <= MAX_QUERY_LENGTH) {
    return stripLoneSurrogates(trimmed)
  }
  const capped = trimmed.slice(0, MAX_QUERY_LENGTH)
  // Drop everything from the last whitespace run on, so a token sliced by
  // the cap cannot act as a broad prefix match. Whitespace-aware (not just
  // ' '): pasted queries may separate words with newlines or tabs, which
  // Postgres' parser also treats as word boundaries.
  const boundary = capped.match(/\s\S*$/)
  return stripLoneSurrogates(
    (boundary ? capped.slice(0, boundary.index) : capped).trim()
  )
}
