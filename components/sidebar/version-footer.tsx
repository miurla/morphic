import { isAnonymousMode } from '@/lib/auth/provider'
import type { AppUser } from '@/lib/auth/types'
import { parseAdminEmails } from '@/lib/version/admins'
import { getVersionCheckConfig } from '@/lib/version/config'
import { resolveInstallMethod } from '@/lib/version/install-method'
import {
  checkForUpdate,
  type UpdateCheckResult
} from '@/lib/version/update-check'

import packageJson from '../../package.json'

/**
 * The viewer counts as an admin when the resolved auth provider is the
 * anonymous one (single-operator mode, which sets no role), when the provider
 * resolved an `admin` role onto the user (e.g. Better Auth), or when the
 * user's email is on the `MORPHIC_ADMIN_EMAILS` allowlist (for providers
 * without a role concept, e.g. Supabase). The user is the one the root layout
 * already resolved, so the footer performs no auth lookup of its own.
 */
function isAdminViewer(user: AppUser | null | undefined): boolean {
  if (isAnonymousMode()) {
    return true
  }
  if (!user) {
    return false
  }
  if (user.role === 'admin') {
    return true
  }
  return (
    !!user.email && parseAdminEmails(process.env).has(user.email.toLowerCase())
  )
}

/**
 * Sidebar footer showing the running version and install method, plus an
 * update link for admins when a newer upstream release exists. Any failure
 * in the update check degrades to version + install label.
 */
export async function VersionFooter({ user }: { user?: AppUser | null }) {
  const version = packageJson.version
  const installMethod = resolveInstallMethod(process.env)
  const { repo } = getVersionCheckConfig()

  let update: UpdateCheckResult | null = null
  try {
    const result = await checkForUpdate(version)
    if (result.hasUpdate && isAdminViewer(user)) {
      update = result
    }
  } catch (error) {
    console.warn('[version] update indicator degraded to label only:', error)
  }

  return (
    <div className="text-xs text-muted-foreground text-center space-y-0.5">
      <div>
        <a
          href={`https://github.com/${repo}/releases`}
          target="_blank"
          rel="noopener"
          className="font-mono underline"
        >
          v{version}
        </a>
      </div>
      <div>
        {update ? (
          <a
            href={update.releaseUrl}
            target="_blank"
            rel="noopener"
            className="text-destructive underline"
          >
            Update: {update.latestVersion}
          </a>
        ) : (
          <span className="italic">{installMethod}</span>
        )}
      </div>
    </div>
  )
}
