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
  variant?: 'default' | 'minimal' | 'process' | 'process-sub'
  showSeparator?: boolean
  renderLeft?: React.ReactNode
  chevronSize?: 'sm' | 'md'
  headerClickBehavior?: 'toggle' | 'inspect' | 'split'
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
  showSeparator = true,
  renderLeft,
  chevronSize = 'md',
  headerClickBehavior = 'toggle'
}: CollapsibleMessageProps) {
  const content = children

  return (
    <div className="flex">
      {renderLeft ? (
        renderLeft
      ) : showIcon ? (
        <div className="relative flex flex-col items-center">
          <div className="w-5">
            {role === 'assistant' ? (
              <IconLogo className="size-5" />
            ) : (
              <CurrentUserAvatar />
            )}
          </div>
        </div>
      ) : null}

      {isCollapsible ? (
        <div
          className={cn(
            'flex-1 overflow-hidden',
            variant === 'default' && showBorder && 'rounded-lg border bg-card',
            variant === 'default' && !showBorder && 'rounded-lg bg-card',
            variant === 'process' && 'rounded-lg border bg-card',
            variant === 'process-sub' && 'rounded-md border bg-card/50',
            // Add background highlight when open and no border (grouped sections)
            isOpen && !showBorder && 'bg-accent/5'
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
                variant === 'minimal' && 'py-1',
                variant === 'process' && 'justify-between px-1.5 py-1',
                variant === 'process-sub' && 'justify-between px-1 py-0.5'
              )}
            >
              {header && (
                <div
                  className={cn(
                    'overflow-hidden',
                    variant === 'default' && 'text-sm flex-1',
                    variant === 'minimal' && 'text-sm flex items-center gap-1',
                    (variant === 'process' || variant === 'process-sub') &&
                      'text-xs flex-1'
                  )}
                  onClick={
                    headerClickBehavior === 'inspect'
                      ? undefined
                      : headerClickBehavior === 'split'
                        ? undefined
                        : onOpenChange
                          ? () => onOpenChange(!isOpen)
                          : undefined
                  }
                >
                  {header}
                </div>
              )}
              {(variant === 'minimal' ||
                variant === 'process' ||
                variant === 'process-sub') && (
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'rounded-md group cursor-pointer hover:bg-accent/50',
                      variant === 'minimal' && 'p-0.5',
                      (variant === 'process' || variant === 'process-sub') &&
                        'p-0.5'
                    )}
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                  >
                    <ChevronDown
                      className={cn(
                        'text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180',
                        chevronSize === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
                      )}
                    />
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
                  variant === 'minimal' && 'pt-2',
                  variant === 'process' && 'px-1.5 pb-1',
                  variant === 'process-sub' && 'px-1 pb-0.5'
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
