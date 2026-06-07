'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

import {
  captureClient,
  identify,
  initPostHog,
  isIdentified,
  reset
} from '@/lib/analytics/posthog-client'

export function PostHogProvider({
  userId,
  children
}: {
  userId: string | null
  children: React.ReactNode
}) {
  useEffect(() => {
    initPostHog()
  }, [])

  useEffect(() => {
    if (userId) {
      identify(userId)
    } else if (isIdentified()) {
      // Only reset on an actual logout, not on every guest mount, so a guest
      // keeps a stable distinct id (persisted in localStorage) across loads.
      reset()
    }
  }, [userId])

  const pathname = usePathname()
  useEffect(() => {
    captureClient('$pageview')
  }, [pathname])

  return <>{children}</>
}
