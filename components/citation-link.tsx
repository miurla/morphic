'use client'

import { memo, useState } from 'react'
import Link from 'next/link'

import type { SearchResultItem } from '@/lib/types'
import { cn } from '@/lib/utils'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'

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
  // Match domain names (alphanumeric and hyphens) or numbers for backward compatibility
  const isCitation = /^[\w-]+$/.test(childrenText)

  const linkClasses = cn(
    isCitation
      ? 'text-[10px] bg-muted/50 text-muted-foreground/60 rounded-full h-4 px-1.5 inline-flex items-center justify-center hover:bg-primary hover:text-primary-foreground duration-200 no-underline -translate-y-0.5 whitespace-nowrap'
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

  // For citations with data, show popover on hover
  if (isCitation && citationData) {
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
          className="w-80 p-0 z-50 shadow-xs"
          side="bottom"
          align="start"
          sideOffset={4}
          onPointerDownOutside={e => e.preventDefault()}
        >
          {citationData ? (
            <Link
              href={citationData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 hover:bg-accent/50 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-4 w-4 shrink-0">
                    <AvatarImage
                      src={`https://www.google.com/s2/favicons?domain=${getHostname(
                        citationData.url
                      )}`}
                      alt={getHostname(citationData.url)}
                    />
                    <AvatarFallback className="text-xs">
                      {getHostname(citationData.url)[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate">
                    {getHostname(citationData.url)}
                  </span>
                </div>
                <p className="text-sm font-medium line-clamp-1">
                  {citationData.title}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {citationData.content}
                </p>
              </div>
            </Link>
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
