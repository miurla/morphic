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
 * can take effect. Truncation happens at the last parser-token boundary
 * before the cap so a partially sliced token cannot act as a broad prefix
 * match.
 */
export const MAX_QUERY_LENGTH = 200

// Minimum length of the effective query. Enforced on the normalized query
// in the route and client, and on the lexemes the FTS parser produces in
// searchChatParts (punctuation can be dropped by the parser, leaving a
// single-character lexeme whose prefix match would scan broadly).
export const MIN_QUERY_LENGTH = 2

// Slicing can split a surrogate pair, and lone surrogates are rejected by
// encodeURIComponent (URIError) and by Postgres' UTF-8 validation. Strip
// them so the normalized query is always encodable.
function stripLoneSurrogates(value: string): string {
  return value.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ''
  )
}

// Postgres' default text-search parser ends a word token at whitespace or
// punctuation; only letters, digits and underscores continue one. The cap
// therefore split a token only when the character after it is one of those.
const WORD_CHAR = /[\p{L}\p{N}_]/u

export function normalizeSearchQuery(query: string): string {
  const trimmed = query.trim()
  if (trimmed.length <= MAX_QUERY_LENGTH) {
    return stripLoneSurrogates(trimmed)
  }
  const capped = trimmed.slice(0, MAX_QUERY_LENGTH)
  // The retained text is complete unless the cap landed inside a word
  // token: whitespace and punctuation ('!' as much as ' ') both end one,
  // so only a word character after the cap means a token was split.
  const next = trimmed[MAX_QUERY_LENGTH]
  if (next === undefined || !WORD_CHAR.test(next)) {
    return stripLoneSurrogates(capped.trim())
  }
  // Drop the trailing partial token so it cannot act as a broad prefix
  // match. When the whole capped range is a single token there is nothing
  // to drop, and a long specific prefix is not broad, so keep it.
  const partial = capped.match(/[\p{L}\p{N}_]+$/u)
  const cut = partial ? capped.slice(0, partial.index) : capped
  return stripLoneSurrogates((cut.trim() || capped).trim())
}
