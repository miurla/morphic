import { redirect } from 'next/navigation'

import { getAuthProvider } from '@/lib/auth/provider'

import { ForgotPasswordForm } from '@/components/forgot-password-form'

// The passwordReset capability depends on runtime env (SMTP configuration),
// so the gate must not be frozen into a static prerender.
export const dynamic = 'force-dynamic'

export default function ForgotPasswordPage() {
  const provider = getAuthProvider()
  if (!provider.capabilities.passwordReset) {
    redirect('/auth/login')
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
