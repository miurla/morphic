'use client'

import { useEffect, useState } from 'react'

import { useChangelog } from '@/hooks/use-changelog'

import { Badge } from '@/components/ui/badge'

export function BetaBadge() {
  const { isVisible } = useChangelog()
  const [hasMessages, setHasMessages] = useState(false)

  useEffect(() => {
    const handleMessagesChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ hasMessages: boolean }>
      setHasMessages(customEvent.detail.hasMessages)
    }

    window.addEventListener('messages-changed', handleMessagesChanged)
    return () =>
      window.removeEventListener('messages-changed', handleMessagesChanged)
  }, [])

  // Don't show if changelog is visible or if there are messages
  if (isVisible || hasMessages) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 animate-in slide-in-from-bottom-5 duration-300">
      <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
        BETA
      </Badge>
    </div>
  )
}
