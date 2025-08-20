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
  variant?: 'default' | 'minimal'
  showSeparator?: boolean
}

export function CollapsibleMessage({
  children,
  role,
  isCollapsible = false,
  isOpen = true,
  header,
  onOpenChange,
  showBorder = true,
  showIcon = true,
  variant = 'default',
  showSeparator = true
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
        <div
          className={cn(
            'flex-1 overflow-hidden',
            variant === 'default' && 'rounded-lg border bg-card'
          )}
        >
          <Collapsible
            open={isOpen}
            onOpenChange={onOpenChange}
            className="w-full"
          >
            <div
              className={cn(
                'flex items-center w-full gap-2 overflow-hidden',
                variant === 'default' && 'justify-between px-3 py-2',
                variant === 'minimal' && 'py-1'
              )}
            >
              {header && (
                <div
                  className={cn(
                    'overflow-hidden',
                    variant === 'default' && 'text-sm flex-1',
                    variant === 'minimal' && 'text-sm flex items-center gap-1'
                  )}
                >
                  {header}
                </div>
              )}
              {variant === 'minimal' && (
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="p-0.5 rounded-md group cursor-pointer hover:bg-accent/50"
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                  >
                    <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
              )}
              {variant === 'default' && (
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="p-1 hover:bg-accent rounded-md transition-transform duration-200 group"
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
              )}
            </div>
            <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
              {showSeparator && variant === 'default' && (
                <Separator className="mb-2 border-border/50" />
              )}
              <div
                className={cn(
                  variant === 'default' && 'px-3 pb-2',
                  variant === 'minimal' && 'pt-2'
                )}
              >
                {content}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : (
        <div
          className={cn(
            'flex-1 rounded-2xl w-full',
            role === 'assistant' ? 'px-0' : 'px-3'
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}
