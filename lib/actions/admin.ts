'use server'

import { headers } from 'next/headers'

import nodemailer from 'nodemailer'

import { getAuth } from '@/lib/auth/better-auth/config'
import {
  createInvitation,
  listInvitations,
  revokeInvitation
} from '@/lib/auth/better-auth/invitations'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getRequestOrigin } from '@/lib/auth/request'
import type { AppUser } from '@/lib/auth/types'

export interface AdminActionResult {
  success: boolean
  error?: string
}

export interface InvitationView {
  id: string
  email: string | null
  token: string
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
  token: string
  revokedAt: Date | null
  usedAt: Date | null
  expiresAt: Date
  createdAt: Date
}): InvitationView {
  return {
    id: invitation.id,
    email: invitation.email,
    token: invitation.token,
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
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  })

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? 'Morphic <noreply@morphic.local>',
    to: params.to,
    subject: 'You are invited to Morphic',
    text: `${params.invitedByName} invited you to Morphic. Accept the invitation: ${params.inviteLink}`,
    html: `<p>${params.invitedByName} invited you to Morphic.</p><p><a href="${params.inviteLink}">Accept the invitation</a></p>`
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

  try {
    const invitation = await createInvitation({
      invitedBy: adminUser.id,
      email: params.email?.trim() || null
    })

    const origin = await getRequestOrigin()
    const link = `${origin}/auth/sign-up?token=${invitation.token}`

    // Additionally email the invitation when SMTP is configured
    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      params.email
    ) {
      try {
        await sendInvitationEmail({
          to: params.email,
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

export async function listInvitationsAction(): Promise<{
  success: boolean
  error?: string
  invitations?: InvitationView[]
}> {
  const adminUser = await requireAdmin()
  if (isAdmin(adminUser)) {
    return adminUser
  }

  try {
    const invitations = await listInvitations()
    return { success: true, invitations: invitations.map(invitationView) }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to list invitations'
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
