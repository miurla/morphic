import Image from 'next/image'

import type { SearchResultItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { faviconUrl } from '@/lib/utils/favicon'

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
  // One favicon per unique result domain
  const favicons = Array.from(
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
    .map(domain => ({ domain, src: faviconUrl(domain, 16) }))
    .filter(entry => entry.src !== '')
    .slice(0, maxDisplay)

  if (favicons.length === 0) {
    return null
  }

  return (
    <div className={cn('flex items-center', className)}>
      {favicons.map(({ domain, src }, index) => (
        <div
          key={domain}
          className="relative rounded-full border border-background overflow-hidden"
          style={{
            marginLeft: index > 0 ? '-6px' : '0',
            zIndex: favicons.length - index
          }}
        >
          <Image
            src={src}
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
