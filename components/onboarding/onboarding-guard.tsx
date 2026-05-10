'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useHasUser } from '@/lib/contexts/user-context'

const SKIP_PATHS = ['/auth', '/onboarding', '/api', '/share']

export function OnboardingGuard() {
  const hasUser = useHasUser()
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (checked) return
    if (!hasUser) {
      setChecked(true)
      return
    }
    if (SKIP_PATHS.some(p => pathname.startsWith(p))) {
      setChecked(true)
      return
    }

    fetch('/api/onboarding')
      .then(res => res.json())
      .then(data => {
        if (!data.onboardingCompleted) {
          router.replace('/onboarding')
        }
        setChecked(true)
      })
      .catch(() => {
        setChecked(true)
      })
  }, [hasUser, pathname, router, checked])

  return null
}
