/** RFC 5321 limit on a forward-path (address) length. */
export const MAX_EMAIL_LENGTH = 254

/**
 * Guard-free format check, linear in the input length.
 *
 * Accepts exactly what /^[^\s@]+@[^\s@]+\.[^\s@]+$/ accepts (no whitespace, a
 * single "@" with a non-empty local part, and a domain with a "." that has a
 * character on each side), but that regex backtracks quadratically on input
 * such as "a@" + "." * n + "@". This function does no length check, so its
 * scaling can be tested directly; callers should use {@link isValidEmail}.
 */
export function hasEmailShape(email: string): boolean {
  const at = email.indexOf('@')
  if (at < 1 || email.indexOf('@', at + 1) !== -1) return false
  if (/\s/.test(email)) return false
  const dot = email.indexOf('.', at + 2)
  return dot !== -1 && dot < email.length - 1
}

/**
 * Pragmatic format check; better-auth enforces deliverable emails at sign-up.
 * Anything over MAX_EMAIL_LENGTH is rejected before any scanning.
 */
export function isValidEmail(email: string): boolean {
  return email.length <= MAX_EMAIL_LENGTH && hasEmailShape(email)
}
