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

  console.log('Citing - href:', href, 'children:', children, 'citationMaps:', citationMaps)

  // Get citation data if this is a numbered citation
  let citationData: SearchResultItem | undefined = undefined
  
  if (isNumber && citationMaps && href) {
    const citationNumber = parseInt(childrenText)
    console.log('Citing - Looking for citation number:', citationNumber)
    
    // Try to find the citation data by checking all citation maps
    // This happens when the URL has already been processed
    for (const toolCallId in citationMaps) {
      const citationMap = citationMaps[toolCallId]
      console.log(`Citing - Checking toolCallId ${toolCallId}:`, citationMap)
      if (citationMap[citationNumber]) {
        // Check if this citation's URL matches the href
        const decodedHref = decodeURI(href)
        console.log(`Citing - Comparing URLs: ${citationMap[citationNumber].url} vs ${decodedHref}`)
        if (citationMap[citationNumber].url === decodedHref) {
          citationData = citationMap[citationNumber]
          console.log('Citing - Found citation data:', citationData)
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
