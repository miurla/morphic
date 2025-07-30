import React from 'react'

import { Link, Search } from 'lucide-react'

import { Badge } from './ui/badge'

type ToolBadgeProps = {
  tool: string
  children: React.ReactNode
  className?: string
}

export const ToolBadge: React.FC<ToolBadgeProps> = ({
  tool,
  children,
  className
}) => {
  const icon: Record<string, React.ReactNode> = {
    search: <Search size={14} />,
    fetch: <Link size={14} />
  }

  return (
    <Badge
      className={`inline-flex items-center max-w-full ${className || ''}`}
      variant={'secondary'}
    >
      <span className="flex-shrink-0">{icon[tool]}</span>
      <span className="ml-1 truncate">{children}</span>
    </Badge>
  )
}
