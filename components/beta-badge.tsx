'use client'

import { useChangelog } from '@/hooks/use-changelog'

import { Badge } from '@/components/ui/badge'

export function BetaBadge() {
  const { isVisible } = useChangelog()

  // Don't show if changelog is visible
  if (isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 animate-in slide-in-from-bottom-5 duration-300">
      <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
        BETA
      </Badge>
    </div>
  )
}
