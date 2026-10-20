export interface VersionCheckConfig {
  /** Upstream `owner/repo` whose latest release is checked. */
  repo: string
  /** Cache window for the upstream release check, in seconds. */
  ttlSeconds: number
  /** When true, no upstream requests are made at all. */
  disabled: boolean
}

const DEFAULT_REPO = 'miurla/morphic'
const DEFAULT_TTL_SECONDS = 86400
const MIN_TTL_SECONDS = 300
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/

/**
 * Pure env parsing so the rules (default, override, floor clamp, invalid
 * fallback, disabled flag) can be covered table-driven without touching
 * `process.env` per case.
 */
export function parseVersionCheckConfig(
  env: Record<string, string | undefined>
): VersionCheckConfig {
  let repo = env.MORPHIC_UPDATE_CHECK_REPO?.trim() || DEFAULT_REPO
  if (!REPO_PATTERN.test(repo)) {
    console.warn(
      `[version] ignoring invalid MORPHIC_UPDATE_CHECK_REPO "${repo}" ` +
        `(expected "owner/repo"); using ${DEFAULT_REPO}`
    )
    repo = DEFAULT_REPO
  }

  let ttlSeconds = DEFAULT_TTL_SECONDS
  const rawTtl = env.MORPHIC_UPDATE_CHECK_TTL_SECONDS?.trim()
  if (rawTtl !== undefined && rawTtl !== '') {
    const parsed = Number(rawTtl)
    if (Number.isFinite(parsed)) {
      ttlSeconds = Math.max(MIN_TTL_SECONDS, Math.trunc(parsed))
    }
  }

  const disabled = env.MORPHIC_UPDATE_CHECK_DISABLED === 'true'

  return { repo, ttlSeconds, disabled }
}

let cachedConfig: VersionCheckConfig | undefined

/** Reads `process.env` once and caches the result for the process lifetime. */
export function getVersionCheckConfig(): VersionCheckConfig {
  cachedConfig ??= parseVersionCheckConfig(process.env)
  return cachedConfig
}
