'use server'

import { headers } from 'next/headers'

import { getAuth } from '@/lib/auth/better-auth/config'
import {
  createInvitation,
  revokeInvitation
} from '@/lib/auth/better-auth/invitations'
import { sendSmtpMail } from '@/lib/auth/better-auth/mailer'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getRequestOrigin } from '@/lib/auth/request'
import type { AppUser } from '@/lib/auth/types'

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

export interface InvitationView {
  id: string
  email: string | null
  revoked: boolean
  used: boolean
  expiresAt: string
  createdAt: string
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

function invitationView(invitation: {
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
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString()
  }
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

    const origin = await getRequestOrigin()
    const link = `${origin}/auth/sign-up?token=${token}`

    // Additionally email the invitation when SMTP is configured
    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD
    ) {
      try {
        await sendInvitationEmail({
          to: email,
          inviteLink: link,
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
