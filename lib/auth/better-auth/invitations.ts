import { createHash, randomBytes } from 'crypto'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'

import { invitations } from './schema'

/** Invitation tokens are valid for one week by default. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface InvitationRecord {
  id: string
  email: string | null
  token: string
  invitedBy: string
  revokedAt: Date | null
  usedAt: Date | null
  expiresAt: Date
  createdAt: Date
}

function toDate(value: Date | string | null): Date | null {
  if (value === null || value === undefined) return null
  return value instanceof Date ? value : new Date(value)
}

function toRecord(row: typeof invitations.$inferSelect): InvitationRecord {
  return {
    ...row,
    revokedAt: toDate(row.revokedAt),
    usedAt: toDate(row.usedAt),
    expiresAt: toDate(row.expiresAt)!,
    createdAt: toDate(row.createdAt)!
  }
}

export function generateInvitationToken(): string {
  return randomBytes(24).toString('hex')
}

/**
 * Invitation tokens are stored as SHA-256 hashes. The plaintext token only
 * exists in the link handed to the admin at creation time, so a database
 * leak cannot be replayed as valid invitations.
 */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createInvitation(params: {
  invitedBy: string
  email: string
  ttlMs?: number
}): Promise<{ invitation: InvitationRecord; token: string }> {
  const token = generateInvitationToken()
  const [row] = await db
    .insert(invitations)
    .values({
      token: hashInvitationToken(token),
      email: params.email,
      invitedBy: params.invitedBy,
      expiresAt: new Date(Date.now() + (params.ttlMs ?? INVITATION_TTL_MS))
    })
    .returning()

  return { invitation: toRecord(row), token }
}

export async function listInvitations(): Promise<InvitationRecord[]> {
  const rows = await db
    .select()
    .from(invitations)
    .orderBy(desc(invitations.createdAt))

  return rows.map(toRecord)
}

/**
 * True when a live bootstrap invitation for the address was created within
 * the cooldown window. The bootstrap branch runs before better-auth's rate
 * limiter, so without this a caller who knows the gated address could loop
 * the sign-up action to flood the mailbox and the table with admin links.
 */
export async function hasRecentBootstrapInvitation(
  email: string,
  cooldownMs: number
): Promise<boolean> {
  const [existing] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        eq(invitations.invitedBy, 'bootstrap'),
        isNull(invitations.usedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
        gt(invitations.createdAt, new Date(Date.now() - cooldownMs))
      )
    )

  return Boolean(existing)
}

/**
 * Resolve an invitation token. Returns the invitation only when it exists,
 * is not revoked, not already used, and not expired.
 */
export async function validateInvitation(
  token: string | null | undefined
): Promise<InvitationRecord | null> {
  if (!token) {
    return null
  }

  const [row] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.token, hashInvitationToken(token)),
        isNull(invitations.revokedAt)
      )
    )

  if (!row) {
    return null
  }

  const invitation = toRecord(row)
  if (invitation.usedAt || invitation.expiresAt.getTime() <= Date.now()) {
    return null
  }

  return invitation
}

export async function revokeInvitation(id: string): Promise<boolean> {
  const [row] = await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.id, id), isNull(invitations.revokedAt)))
    .returning({ id: invitations.id })

  return Boolean(row)
}

/** Marks an invitation as consumed. Returns false if already consumed. */
export async function consumeInvitation(id: string): Promise<boolean> {
  const [row] = await db
    .update(invitations)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(invitations.id, id),
        isNull(invitations.usedAt),
        isNull(invitations.revokedAt)
      )
    )
    .returning({ id: invitations.id })

  return Boolean(row)
}
