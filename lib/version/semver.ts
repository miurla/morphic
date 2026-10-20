export interface ReleaseVersion {
  major: number
  minor: number
  patch: number
}

/**
 * Parses a release tag such as `v1.8.0` (or `1.8.0`) into its numeric parts.
 * Returns null for anything that is not a plain `X.Y.Z` version, so prerelease
 * tags like `v1.8.0-rc1` fall through as "no update".
 */
export function parseReleaseTag(tag: string): ReleaseVersion | null {
  const normalized = tag.startsWith('v') ? tag.slice(1) : tag
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(normalized)
  if (!match) {
    return null
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  }
}

/**
 * True only when `tag` parses and is numerically greater than `current`,
 * compared by major, then minor, then patch. Equal, lower, or unparseable
 * inputs are treated as no update available.
 */
export function isUpdateAvailable(current: string, tag: string): boolean {
  const currentVersion = parseReleaseTag(current)
  const latestVersion = parseReleaseTag(tag)
  if (!currentVersion || !latestVersion) {
    return false
  }
  if (latestVersion.major !== currentVersion.major) {
    return latestVersion.major > currentVersion.major
  }
  if (latestVersion.minor !== currentVersion.minor) {
    return latestVersion.minor > currentVersion.minor
  }
  return latestVersion.patch > currentVersion.patch
}
