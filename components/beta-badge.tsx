'use client'

import { Badge } from '@/components/ui/badge'

export function BetaBadge() {
  return (
    <div className="fixed bottom-4 left-4 z-40">
      <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
        BETA
      </Badge>
    </div>
  )
}
