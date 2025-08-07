import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from './ui/collapsible'
import { IconLogo } from './ui/icons'
import { Separator } from './ui/separator'
import { CurrentUserAvatar } from './current-user-avatar'

interface CollapsibleMessageProps {
  children: React.ReactNode
  role: 'user' | 'assistant'
  isCollapsible?: boolean
  isOpen?: boolean
  header?: React.ReactNode
  onOpenChange?: (open: boolean) => void
  showBorder?: boolean
  showIcon?: boolean
}

export function CollapsibleMessage({
  children,
  role,
  isCollapsible = false,
  isOpen = true,
  header,
  onOpenChange,
  showBorder = true,
  showIcon = true
}: CollapsibleMessageProps) {
  const content = children

  return (
    <div className="flex">
      {showIcon && (
        <div className="relative flex flex-col items-center">
          <div className="w-5">
            {role === 'assistant' ? (
              <IconLogo className="size-5" />
            ) : (
              <CurrentUserAvatar />
            )}
          </div>
        </div>
      )}

      {isCollapsible ? (
        <div className={cn('flex-1 rounded-lg border bg-card')}>
          <Collapsible
            open={isOpen}
            onOpenChange={onOpenChange}
            className="w-full"
          >
            <div className="flex items-center justify-between w-full gap-2 px-3 py-2">
              {header && <div className="text-sm w-full">{header}</div>}
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="rounded-md p-1 hover:bg-accent group"
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
              <Separator className="mb-2 border-border/50" />
              <div className="px-3 pb-2">{content}</div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : (
        <div
          className={cn(
            'flex-1 rounded-2xl',
            role === 'assistant' ? 'px-0' : 'px-3'
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}
