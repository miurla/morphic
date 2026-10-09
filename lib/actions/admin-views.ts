export interface InvitationView {
  id: string
  email: string | null
  revoked: boolean
  used: boolean
  expired: boolean
  expiresAt: string
  createdAt: string
}

/**
 * Server clock snapshot handed to the client so it can correct its own
 * clock: a browser running ahead would otherwise mark live invitations
 * expired and hide their Revoke buttons, while one running behind keeps
 * showing expired links as active.
 */
export function serverNow(): string {
  return new Date().toISOString()
}

/**
 * Project an invitation row onto the shape the admin UI renders. Lives
 * outside the `'use server'` action module so server components can call
 * it during render; the expiration is computed here (not in the client
 * component) because render functions must stay pure.
 */
export function invitationView(invitation: {
  id: string
  email: string | null
  revokedAt: Date | null
  usedAt: Date | null
  expiresAt: Date
  createdAt: Date
}): InvitationView {
  return {
    id: invitation.id,
    email: invitation.email,
    revoked: Boolean(invitation.revokedAt),
    used: Boolean(invitation.usedAt),
    expired: invitation.expiresAt.getTime() <= Date.now(),
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString()
  }
}
