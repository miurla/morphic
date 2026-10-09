'use server'

import { headers } from 'next/headers'

import { type InvitationView, invitationView } from '@/lib/actions/admin-views'
import { getAuth, getEmailLinkOrigin } from '@/lib/auth/better-auth/config'
import {
  createInvitation,
  revokeInvitation
} from '@/lib/auth/better-auth/invitations'
import { sendSmtpMail } from '@/lib/auth/better-auth/mailer'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getRequestOrigin } from '@/lib/auth/request'
import type { AppUser } from '@/lib/auth/types'

export type { InvitationView } from '@/lib/actions/admin-views'

export interface AdminActionResult {
  success: boolean
  error?: string
}

/** Pragmatic format check; better-auth enforces deliverable emails at sign-up. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function requireAdmin(): Promise<AppUser | AdminActionResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'Not authenticated.' }
  }
  if (user.role !== 'admin') {
    return { success: false, error: 'Admin access required.' }
  }
  return user
}

function isAdmin(
  result: AppUser | AdminActionResult
): result is AdminActionResult {
  return typeof (result as AdminActionResult).success === 'boolean'
}

async function sendInvitationEmail(params: {
  to: string
  inviteLink: string
  invitedByName: string
}): Promise<void> {
  await sendSmtpMail({
    to: params.to,
    subject: 'You are invited to Morphic',
    text: `${params.invitedByName} invited you to Morphic. Accept the invitation: ${params.inviteLink}`,
    html: `<p>${escapeHtml(params.invitedByName)} invited you to Morphic.</p><p><a href="${escapeHtml(params.inviteLink)}">Accept the invitation</a></p>`
  })
}

export async function createInvitationAction(params: {
  email?: string
}): Promise<
  AdminActionResult & { invitation?: InvitationView; link?: string }
> {
  const adminUser = await requireAdmin()
  if (isAdmin(adminUser)) {
    return adminUser
  }

  // Invitations are always addressed to a specific person: an unaddressed
  // link would just be open sign-up behind an obscure URL, and open sign-up
  // is already an explicit choice via AUTH_SIGNUP_MODE=open.
  const email = params.email?.trim()
  if (!email || !EMAIL_REGEX.test(email)) {
    return { success: false, error: 'A valid email address is required.' }
  }

  try {
    // The plaintext token is only available here, at creation time: the
    // database stores just its hash, so the link cannot be rebuilt later.
    const { invitation, token } = await createInvitation({
      invitedBy: adminUser.id,
      email
    })

    const canonical = getEmailLinkOrigin()
    const link = `${canonical || (await getRequestOrigin())}/auth/sign-up?token=${token}`

    // Additionally email the invitation when SMTP is configured. The
    // emailed link uses only the canonical BETTER_AUTH_URL origin: a link
    // built from request headers could ship the live token to an attacker
    // domain via a spoofed Host. Without a canonical origin the admin
    // copies the link manually instead.
    if (
      canonical &&
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD
    ) {
      try {
        await sendInvitationEmail({
          to: email,
          inviteLink: `${canonical}/auth/sign-up?token=${token}`,
          invitedByName: adminUser.name || adminUser.email || 'An admin'
        })
      } catch (error) {
        console.error('Failed to send invitation email:', error)
      }
    }

    return { success: true, invitation: invitationView(invitation), link }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to create invitation'
    }
  }
}

export async function revokeInvitationAction(
  id: string
): Promise<AdminActionResult> {
  const adminUser = await requireAdmin()
  if (isAdmin(adminUser)) {
    return adminUser
  }

  try {
    const revoked = await revokeInvitation(id)
    return revoked
      ? { success: true }
      : { success: false, error: 'Invitation not found or already revoked.' }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to revoke invitation'
    }
  }
}

export async function resetMemberPasswordAction(params: {
  userId: string
  newPassword: string
}): Promise<AdminActionResult> {
  const adminUser = await requireAdmin()
  if (isAdmin(adminUser)) {
    return adminUser
  }

  if (!params.newPassword || params.newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' }
  }

  try {
    // Note: better-auth's setUserPassword re-hashes the credential but
    // leaves the member's existing sessions valid; a reset done because of
    // a suspected compromise does not log the member out until those
    // sessions expire naturally.
    await getAuth().api.setUserPassword({
      body: {
        userId: params.userId,
        newPassword: params.newPassword
      },
      headers: await headers()
    })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset password'
    }
  }
}

export async function promoteMemberAction(params: {
  userId: string
}): Promise<AdminActionResult> {
  const adminUser = await requireAdmin()
  if (isAdmin(adminUser)) {
    return adminUser
  }

  try {
    // Promotion only ever adds an admin, so it cannot strand the instance
    // without one; demotion is deliberately not offered because the
    // last-admin deletion guard has no equivalent for role changes.
    await getAuth().api.setRole({
      body: { userId: params.userId, role: 'admin' },
      headers: await headers()
    })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to promote member'
    }
  }
}

/**
 * Server clock sample for the invitations manager's expiry clock. The
 * round-trip latency of this call is the only error it carries, unlike
 * the render-time snapshot whose age includes the pre-hydration delay.
 * No guard: the server clock is already observable from any response's
 * Date header.
 */
export async function getServerTime(): Promise<number> {
  return Date.now()
}
