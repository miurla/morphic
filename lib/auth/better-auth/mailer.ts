import nodemailer from 'nodemailer'

/**
 * Shared SMTP plumbing for every email Morphic's better-auth provider
 * delivers (password resets, invitation emails). better-auth 1.7 removed
 * its built-in nodemailer transport, so the `email.server` option no
 * longer sends anything; delivery goes through the callbacks in
 * lib/auth/better-auth/config.ts, which call into here.
 */
export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  )
}

export async function sendSmtpMail(message: {
  to: string
  subject: string
  text: string
  html?: string
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
    ...message
  })
}
