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

// Which characters can continue the token a cap landed inside, verified
// against Postgres 17's default text-search parser: hyphens (foo-bar ->
// {foo, bar, foo-bar}), dots (a.b, 1.23, 192.168.1.1), slashes (a/b/c.d),
// @ (user@example.com), and colons (example.com:80) all produce compound
// tokens; underscores (x1_2 -> {x1, 2}), apostrophes (don't -> {don, t}),
// and other punctuation split tokens instead. Reimplementing every token
// rule in JS is a rabbit hole, so the cap is conservative: when the
// character after the cap could continue a compound token, the whole
// trailing fragment is dropped. Over-dropping a complete token is a minor
// precision loss; keeping a fragment changes the query, which is the bug.
const TOKEN_CONT = /[\p{L}\p{N}.\-/@:]/u
const TRAILING_FRAGMENT = /[\p{L}\p{N}.\-/@:]+$/u

export function normalizeSearchQuery(query: string): string {
  const trimmed = query.trim()
  if (trimmed.length <= MAX_QUERY_LENGTH) {
    return stripLoneSurrogates(trimmed)
  }
  const capped = trimmed.slice(0, MAX_QUERY_LENGTH)
  // The retained text is complete unless the cap landed inside a token the
  // parser could continue: whitespace and plain punctuation ('!' as much as
  // ' ') both end every token type, so only a continuation character after
  // the cap means a token was split.
  const next = trimmed[MAX_QUERY_LENGTH]
  if (next === undefined || !TOKEN_CONT.test(next)) {
    return stripLoneSurrogates(capped.trim())
  }
  // Drop the trailing fragment (everything since the last whitespace) so a
  // partial token cannot act as a broad prefix match. When the whole capped
  // range is a single fragment there is nothing to drop, and a long
  // specific prefix is not broad, so keep it.
  const fragment = capped.match(TRAILING_FRAGMENT)
  const cut = fragment ? capped.slice(0, fragment.index) : capped
  return stripLoneSurrogates((cut.trim() || capped).trim())
}
