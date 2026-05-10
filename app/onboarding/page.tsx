import { redirect } from 'next/navigation'

import { getCurrentUserId } from '@/lib/auth/get-current-user'

import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'

export default async function OnboardingPage() {
  const userId = await getCurrentUserId()
  if (!userId || userId === 'anonymous-user') {
    redirect('/auth/login')
  }

  return <OnboardingFlow />
}
