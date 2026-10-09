import { betterAuthProvider } from '@/lib/auth/providers/better-auth'
import { noneAuthProvider } from '@/lib/auth/providers/none'
import { supabaseAuthProvider } from '@/lib/auth/providers/supabase'
import type {
  AuthCapabilities,
  AuthProvider,
  AuthProviderName
} from '@/lib/auth/types'

const AUTH_PROVIDER_NAMES: AuthProviderName[] = [
  'supabase',
  'better-auth',
  'none'
]

// Providers register here as they ship.
const providerRegistry: Partial<Record<AuthProviderName, AuthProvider>> = {
  supabase: supabaseAuthProvider,
  'better-auth': betterAuthProvider,
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
 * Whether sharing is enabled. ENABLE_SHARE is the runtime (non-public)
 * flag and works in prebuilt images; NEXT_PUBLIC_ENABLE_SHARE is kept for
 * source builds, but Next inlines NEXT_PUBLIC_* at build time even in
 * server bundles, so it cannot be flipped at runtime in a published
 * image. shareChat enforces the same helper server-side.
 */
export function isShareEnabled(): boolean {
  return (
    process.env.ENABLE_SHARE === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_SHARE === 'true'
  )
}

/**
 * Fold the sharing opt-in flag into a provider's capabilities. Must be
 * evaluated on the server: client components inline NEXT_PUBLIC_* values
 * at build time, which would freeze the setting in prebuilt images.
 * shareChat enforces the same flag server-side.
 */
export function withShareOptIn(
  capabilities: AuthCapabilities
): AuthCapabilities {
  return {
    ...capabilities,
    share: capabilities.share && isShareEnabled()
  }
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
