import { AnchorHTMLAttributes, DetailedHTMLProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { useCitation } from './citation-context'
import { CitationLink } from './citation-link'

type CustomLinkProps = Omit<
  DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>,
  'ref'
> & {
  children: ReactNode
}

export function Citing({
  href,
  children,
  className,
  ...props
}: CustomLinkProps) {
  const { citationMap } = useCitation()
  const childrenText = children?.toString() || ''
  const isNumber = /^\d+$/.test(childrenText)
  
  // Get citation data if this is a numbered citation
  const citationNumber = isNumber ? parseInt(childrenText) : null
  const citationData = citationNumber && citationMap ? citationMap[citationNumber] : undefined

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
