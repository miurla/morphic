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
  const isNumber = /^\d+$/.test(childrenText)

  // Get citation data if this is a numbered citation
  let citationData: SearchResultItem | undefined = undefined
  
  if (isNumber && citationMaps && href) {
    const citationNumber = parseInt(childrenText)
    
    // Try to find the citation data by checking all citation maps
    // This happens when the URL has already been processed
    for (const toolCallId in citationMaps) {
      const citationMap = citationMaps[toolCallId]
      if (citationMap[citationNumber]) {
        // Check if this citation's URL matches the href
        if (citationMap[citationNumber].url === decodeURI(href)) {
          citationData = citationMap[citationNumber]
          break
        }
      }
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
