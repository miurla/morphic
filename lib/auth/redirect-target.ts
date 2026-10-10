/**
 * Validates a post-login redirect target. Only same-origin relative paths
 * are accepted: a crafted ?next= (protocol-relative URL, backslash or
 * stripped-whitespace tricks, absolute URL) must not bounce a signed-in
 * user off-site. Anything else falls back to the app root.
 */
export function safeRedirectPath(next: string | undefined): string {
  if (!next) {
    return '/'
  }
  try {
    // The base origin is arbitrary: anything that resolves away from it
    // (protocol-relative URLs, backslash-normalized paths, absolute URLs,
    // non-HTTP schemes) is rejected.
    const url = new URL(next, 'http://redirect-target.invalid')
    if (
      url.origin !== 'http://redirect-target.invalid' ||
      url.username ||
      url.password
    ) {
      return '/'
    }
    return url.pathname + url.search + url.hash
  } catch {
    return '/'
  }
}
