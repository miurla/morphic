'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

import {
  captureClient,
  identify,
  initPostHog,
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
    } else {
      reset()
    }
  }, [userId])

  const pathname = usePathname()
  useEffect(() => {
    captureClient('$pageview')
  }, [pathname])

  return <>{children}</>
}
