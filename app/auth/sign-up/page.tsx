import { redirect } from 'next/navigation'

import { getSignUpMode } from '@/lib/auth/better-auth/config'
import { validateInvitation } from '@/lib/auth/better-auth/invitations'
import { getAuthProvider } from '@/lib/auth/provider'

import { InviteRequired } from '@/components/invite-required'
import { SignUpForm } from '@/components/sign-up-form'

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const provider = getAuthProvider()

  if (!provider.capabilities.signUp) {
    redirect('/auth/login')
  }

  let inviteRequired = false
  let validToken: string | undefined
  let inviteEmail: string | undefined

  if (provider.name === 'better-auth' && getSignUpMode() === 'invite') {
    const { token } = await searchParams
    const invitation = await validateInvitation(token)
    if (invitation) {
      validToken = token
      inviteEmail = invitation.email ?? undefined
    } else {
      inviteRequired = true
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {inviteRequired ? (
          <InviteRequired />
        ) : (
          <SignUpForm token={validToken} inviteEmail={inviteEmail} />
        )}
      </div>
    </div>
  )
}
