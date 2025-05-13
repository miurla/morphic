'use client'

import * as React from 'react'
import { Button, ButtonProps } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

interface TooltipButtonProps extends ButtonProps {
  /**
   * The tooltip content to display.
   * Can be a string or TooltipContent props.
   */
  tooltipContent: string | Omit<React.ComponentPropsWithoutRef<typeof TooltipContent>, 'children'> & {
    children: React.ReactNode
  }
  /**
   * The content of the button.
   */
  children: React.ReactNode
}

/**
 * A button component with a tooltip.
 */
export const TooltipButton = React.forwardRef<
  HTMLButtonElement,
  TooltipButtonProps
>(({ tooltipContent, children, ...buttonProps }, ref) => {
  const tooltipProps =
    typeof tooltipContent === 'string'
      ? { children: <p>{tooltipContent}</p> }
      : tooltipContent

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button ref={ref} {...buttonProps}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent {...tooltipProps} />
    </Tooltip>
  )
})

TooltipButton.displayName = 'TooltipButton'
