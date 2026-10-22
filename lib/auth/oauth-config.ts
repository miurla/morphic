/**
 * OAuth configuration utilities that are safe to use in client components.
 * This file must not import server-only modules like next/headers.
 */

/**
 * Check if OIDC is fully configured.
 * Returns true if all required OIDC environment variables are set.
 *
 * Required variables:
 * - OIDC_ISSUER
 * - OIDC_CLIENT_ID
 * - OIDC_CLIENT_SECRET
 *
 * OIDC_SCOPE is optional and defaults to 'openid profile email'.
 */
export function isOidcConfigured(): boolean {
  return !!(
    process.env.OIDC_ISSUER?.trim() &&
    process.env.OIDC_CLIENT_ID?.trim() &&
    process.env.OIDC_CLIENT_SECRET?.trim()
  )
}

/**
 * Get the display name for the OIDC provider.
 * Returns the value of OIDC_PROVIDER_NAME or 'OIDC' as default.
 */
export function getOidcProviderName(): string {
  return process.env.OIDC_PROVIDER_NAME?.trim() || 'OIDC'
}

/**
 * Get OAuth provider configuration for UI display
 */
export function getOAuthConfig(): { provider: 'oidc' | null; name: string } {
  if (isOidcConfigured()) {
    return { provider: 'oidc', name: getOidcProviderName() }
  }
  return { provider: null, name: '' }
}
