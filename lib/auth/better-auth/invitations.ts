import { randomBytes } from 'crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'

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

export async function createInvitation(params: {
  invitedBy: string
  email?: string | null
  ttlMs?: number
}): Promise<InvitationRecord> {
  const [row] = await db
    .insert(invitations)
    .values({
      token: generateInvitationToken(),
      email: params.email ?? null,
      invitedBy: params.invitedBy,
      expiresAt: new Date(Date.now() + (params.ttlMs ?? INVITATION_TTL_MS))
    })
    .returning()

  return toRecord(row)
}

export async function listInvitations(): Promise<InvitationRecord[]> {
  const rows = await db
    .select()
    .from(invitations)
    .orderBy(desc(invitations.createdAt))

  return rows.map(toRecord)
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
    .where(and(eq(invitations.token, token), isNull(invitations.revokedAt)))

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
