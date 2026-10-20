/**
 * Parses `MORPHIC_ADMIN_EMAILS`: a comma-separated allowlist of email
 * addresses that count as admins for the version footer's update link.
 * Intended for auth providers without a role concept (e.g. Supabase), where
 * no user ever carries an `admin` role. Matching is case-insensitive;
 * entries are trimmed and empty segments are ignored.
 */
export function parseAdminEmails(
  env: Record<string, string | undefined>
): Set<string> {
  const raw = env.MORPHIC_ADMIN_EMAILS ?? ''
  return new Set(
    raw
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0)
  )
}
