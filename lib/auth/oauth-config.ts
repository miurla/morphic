/**
 * OAuth configuration utilities that are safe to use in client components.
 * This file must not import server-only modules like next/headers.
 */

/**
 * The character superclass the provider-callback path may contain, used to
 * validate OIDC_PROVIDER_ID (mirrors the callback allowlist rules).
 */
export const OIDC_PROVIDER_ID_PATTERN = /^[A-Za-z0-9_.:$-]{1,128}$/

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
 * The provider id the generic OAuth/OIDC plugin registers and that the
 * callback URL is derived from:
 *
 *   <BETTER_AUTH_URL>/api/auth/callback/<OIDC_PROVIDER_ID>
 *
 * The OIDC `sub` claim is only unique per issuer, so accounts are keyed by
 * (providerId, sub): changing OIDC_ISSUER must come with a new provider id,
 * otherwise identities from the two issuers collide in the account table.
 */
export function getOidcProviderId(): string {
  const raw = process.env.OIDC_PROVIDER_ID?.trim() || 'oidc'
  if (!OIDC_PROVIDER_ID_PATTERN.test(raw)) {
    throw new Error(
      `Invalid OIDC_PROVIDER_ID "${process.env.OIDC_PROVIDER_ID}". ` +
        'Use 1-128 characters of letters, digits or "_.:$-".'
    )
  }
  return raw
}

/**
 * Get the display name for the OIDC provider.
 * Returns the value of OIDC_PROVIDER_NAME or 'OIDC' as default.
 */
export function getOidcProviderName(): string {
  return process.env.OIDC_PROVIDER_NAME?.trim() || 'OIDC'
}
