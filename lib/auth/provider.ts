import { noneAuthProvider } from '@/lib/auth/providers/none'
import { supabaseAuthProvider } from '@/lib/auth/providers/supabase'
import type { AuthProvider, AuthProviderName } from '@/lib/auth/types'

const AUTH_PROVIDER_NAMES: AuthProviderName[] = [
  'supabase',
  'better-auth',
  'none'
]

// Providers register here as they ship. `better-auth` is an accepted
// configuration value reserved for a follow-up release.
const providerRegistry: Partial<Record<AuthProviderName, AuthProvider>> = {
  supabase: supabaseAuthProvider,
  none: noneAuthProvider
}

function enforceCloudDeploymentGuard(
  name: AuthProviderName,
  explicitlyConfigured: boolean
): void {
  if (process.env.MORPHIC_CLOUD_DEPLOYMENT !== 'true' || name === 'supabase') {
    return
  }
  if (name === 'none' && !explicitlyConfigured) {
    // Preserve the historical message for ENABLE_AUTH=false deployments
    throw new Error(
      'ENABLE_AUTH=false is not allowed in MORPHIC_CLOUD_DEPLOYMENT'
    )
  }
  throw new Error(
    `AUTH_PROVIDER=${name} is not allowed in MORPHIC_CLOUD_DEPLOYMENT`
  )
}

/**
 * Resolve the active auth provider name from configuration.
 *
 * When `AUTH_PROVIDER` is unset the provider is derived from the existing
 * environment so current deployments behave identically:
 * - `ENABLE_AUTH=false` -> `none` (anonymous mode)
 * - otherwise -> `supabase` (the Supabase provider no-ops to guest behavior
 *   when Supabase is not configured, exactly as before)
 */
export function resolveAuthProviderName(): AuthProviderName {
  const configured = process.env.AUTH_PROVIDER?.trim()

  let name: AuthProviderName
  if (configured) {
    if (!AUTH_PROVIDER_NAMES.includes(configured as AuthProviderName)) {
      throw new Error(
        `Invalid AUTH_PROVIDER "${configured}". Expected one of: ${AUTH_PROVIDER_NAMES.join(', ')}`
      )
    }
    name = configured as AuthProviderName
  } else {
    name = process.env.ENABLE_AUTH === 'false' ? 'none' : 'supabase'
  }

  enforceCloudDeploymentGuard(name, Boolean(configured))
  return name
}

/**
 * True when the active provider shares a single identity across all visitors
 * (anonymous mode). Feature gates must use this instead of reading
 * `ENABLE_AUTH` directly, so that `AUTH_PROVIDER=none` and the derived
 * `ENABLE_AUTH=false` behavior always agree.
 */
export function isAnonymousMode(): boolean {
  return resolveAuthProviderName() === 'none'
}

/** Return the active auth provider implementation. */
export function getAuthProvider(): AuthProvider {
  const name = resolveAuthProviderName()
  const provider = providerRegistry[name]
  if (!provider) {
    throw new Error(
      `AUTH_PROVIDER=${name} is not available in this version of Morphic.`
    )
  }
  return provider
}
