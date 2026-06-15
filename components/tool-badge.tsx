import React from 'react'

import { Link, RssFeed as Rss, Search } from 'iconoir-react'

import { cn } from '@/lib/utils'

import { Badge } from './ui/badge'

type ToolBadgeProps = {
  tool: string
  children: React.ReactNode
  className?: string
  isLoading?: boolean
}

export const ToolBadge: React.FC<ToolBadgeProps> = ({
  tool,
  children,
  className,
  isLoading = false
}) => {
  const icon: Record<string, React.ReactNode> = {
    search: <Search width={14} height={14} />,
    feedSearch: <Rss width={14} height={14} />,
    fetch: <Link width={14} height={14} />
  }

  return (
    <Badge
      className={cn(
        'inline-flex items-center max-w-full',
        isLoading && 'animate-pulse',
        className
      )}
      variant={'secondary'}
    >
      <span className="shrink-0">{icon[tool]}</span>
      <span className="ml-1 truncate">{children}</span>
    </Badge>
  )
}
