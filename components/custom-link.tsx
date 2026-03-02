import { AnchorHTMLAttributes, DetailedHTMLProps } from 'react'

import type { SearchResultItem } from '@/lib/types'
import { cn } from '@/lib/utils'

import { useCitation } from './citation-context'
import { CitationLink } from './citation-link'

type CustomLinkProps = Omit<
  DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>,
  'ref'
>

export function Citing({
  href,
  children,
  className,
  ...props
}: CustomLinkProps) {
  const { citationMaps } = useCitation()
  const childrenText = children?.toString() || ''
  // Match domain names (alphanumeric and hyphens) or numbers for backward compatibility
  const isCitation = /^[\w-]+$/.test(childrenText)

  // Get citation data if this is a citation
  let citationData: SearchResultItem | undefined = undefined

  if (isCitation && citationMaps && href) {
    const decodedHref = decodeURI(href)

    // Try to find the citation data by checking all citation maps
    // Match by URL instead of citation number/text
    for (const toolCallId in citationMaps) {
      const citationMap = citationMaps[toolCallId]
      // Search through all citations in this map
      for (const citationNum in citationMap) {
        if (citationMap[citationNum].url === decodedHref) {
          citationData = citationMap[citationNum]
          break
        }
      }
      if (citationData) break
    }
  }

  return (
    <CitationLink
      href={href || '#'}
      className={className}
      citationData={citationData}
      {...props}
    >
      {children}
    </CitationLink>
  )
}
