import Image from 'next/image'

import type { SearchResultItem } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SourceFaviconsProps {
  results: SearchResultItem[]
  maxDisplay?: number
  className?: string
}

/**
 * Displays overlapping favicons from search results
 */
export function SourceFavicons({
  results,
  maxDisplay = 3,
  className
}: SourceFaviconsProps) {
  // Extract unique domains from results
  const uniqueDomains = Array.from(
    new Set(
      results.map(result => {
        try {
          return new URL(result.url).hostname
        } catch {
          return null
        }
      })
    )
  )
    .filter((domain): domain is string => domain !== null)
    .slice(0, maxDisplay)

  if (uniqueDomains.length === 0) {
    return null
  }

  return (
    <div className={cn('flex items-center', className)}>
      {uniqueDomains.map((domain, index) => (
        <div
          key={domain}
          className="relative rounded-full border border-background overflow-hidden"
          style={{
            marginLeft: index > 0 ? '-6px' : '0',
            zIndex: uniqueDomains.length - index
          }}
        >
          <Image
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
            alt={domain}
            width={16}
            height={16}
            className="bg-background"
            unoptimized
          />
        </div>
      ))}
    </div>
  )
}
