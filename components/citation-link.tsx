'use client'

import { memo, useState } from 'react'
import Link from 'next/link'

import type { SearchResultItem } from '@/lib/types'
import { cn } from '@/lib/utils'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface CitationLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  citationData?: SearchResultItem
}

// Helper function to safely extract hostname from URL
const getHostname = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return 'unknown'
  }
}

export const CitationLink = memo(function CitationLink({
  href,
  children,
  className,
  citationData
}: CitationLinkProps) {
  const [open, setOpen] = useState(false)
  const childrenText = children?.toString() || ''
  const isNumber = /^\d+$/.test(childrenText)
  
  const linkClasses = cn(
    isNumber
      ? 'text-[10px] bg-muted text-muted-foreground rounded-full w-4 h-4 px-0.5 inline-flex items-center justify-center hover:bg-muted/50 duration-200 no-underline -translate-y-0.5'
      : 'hover:underline inline-flex items-center gap-1.5',
    className
  )

  // If no citation data, render as simple link
  if (!citationData) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClasses}
      >
        {children}
      </a>
    )
  }

  // For numbered citations with data, show popover on hover
  if (isNumber && citationData) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClasses}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            {children}
          </a>
        </PopoverTrigger>
        <PopoverContent 
          className="w-72 p-3 z-50" 
          side="top" 
          align="center"
          sideOffset={8}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {citationData ? (
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Avatar className="h-4 w-4 mt-0.5 flex-shrink-0">
                  <AvatarImage
                    src={`https://www.google.com/s2/favicons?domain=${
                      getHostname(citationData.url)
                    }`}
                    alt={getHostname(citationData.url)}
                  />
                  <AvatarFallback className="text-xs">
                    {getHostname(citationData.url)[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1">
                  <Link
                    href={citationData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline block"
                  >
                    <span className="line-clamp-2">
                      {citationData.title}
                    </span>
                  </Link>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {citationData.content}
                  </p>
                  <p className="text-xs text-muted-foreground/80 truncate">
                    {getHostname(citationData.url)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    )
  }

  // For non-numbered citations, render as regular link
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClasses}
    >
      {children}
    </a>
  )
})