import { getVersionCheckConfig } from './config'
import { isUpdateAvailable, parseReleaseTag } from './semver'

export type UpdateCheckResult =
  | { hasUpdate: false }
  | { hasUpdate: true; latestVersion: string; releaseUrl: string }

const NO_UPDATE: UpdateCheckResult = { hasUpdate: false }

const REQUEST_TIMEOUT_MS = 2000

let lastFailureAt = 0
let inFlight: Promise<string | null> | null = null

/** Clears the failure backoff and the in-flight slot. Exported for tests only. */
export function resetFailureBackoff(): void {
  lastFailureAt = 0
  inFlight = null
}

/**
 * Fetches the latest release tag from the configured repo. Returns the tag on
 * success, or null for every failure mode (throw, timeout, non-2xx, malformed
 * JSON, missing tag) after logging a warning and arming the failure backoff.
 */
async function fetchLatestTag(
  repo: string,
  ttlSeconds: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        next: { revalidate: ttlSeconds },
        headers: { accept: 'application/vnd.github+json' }
      }
    )

    if (!response.ok) {
      lastFailureAt = Date.now()
      console.warn(
        `[version] update check failed with status ${response.status}`
      )
      return null
    }

    const release = (await response.json()) as { tag_name?: unknown }
    const tag =
      typeof release.tag_name === 'string' ? release.tag_name : undefined

    if (!tag || !parseReleaseTag(tag)) {
      lastFailureAt = Date.now()
      console.warn('[version] update check returned an unusable release tag')
      return null
    }

    lastFailureAt = 0
    return tag
  } catch (error) {
    lastFailureAt = Date.now()
    console.warn('[version] update check failed:', error)
    return null
  }
}

/**
 * Checks the upstream GitHub releases feed for a newer stable release.
 * Every failure mode (throw, timeout, non-2xx, malformed JSON, missing tag)
 * degrades to the no-update result with a warn-level log; callers never see
 * an exception and no user-facing error is produced.
 *
 * Next's fetch cache only stores successful responses, so network errors,
 * non-2xx responses, and unusable release tags get a module-level negative
 * cache: without it, an unreachable upstream or a repo whose latest release is
 * not tagged `X.Y.Z` would retry (and warn) on every page render instead of
 * once per cache window. Concurrent calls share a single in-flight upstream
 * request; each caller compares the shared release tag against its own
 * version, so the shared fetch never changes a caller's verdict.
 */
export async function checkForUpdate(
  currentVersion: string
): Promise<UpdateCheckResult> {
  const { repo, ttlSeconds, disabled } = getVersionCheckConfig()
  if (disabled) {
    return NO_UPDATE
  }

  if (Date.now() - lastFailureAt < ttlSeconds * 1000) {
    return NO_UPDATE
  }

  const pending =
    inFlight ??
    (inFlight = fetchLatestTag(repo, ttlSeconds).finally(() => {
      inFlight = null
    }))
  const tag = await pending

  if (!tag || !isUpdateAvailable(currentVersion, tag)) {
    return NO_UPDATE
  }

  // The URL is constructed from the configured repo and the parsed tag
  // rather than taken from the response body, so nothing in the payload
  // can steer the admin-facing link.
  const releaseUrl = `https://github.com/${repo}/releases/tag/${tag}`
  const latestVersion = tag.startsWith('v') ? tag : `v${tag}`

  return { hasUpdate: true, latestVersion, releaseUrl }
}
