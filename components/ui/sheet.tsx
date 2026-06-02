'use client'

import * as React from 'react'

import * as SheetPrimitive from '@radix-ui/react-dialog'
import { IconX as X } from '@tabler/icons-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils/index'

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-[120ms] data-[state=closed]:duration-[90ms] data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  'native-translucent-surface fixed z-50 gap-4 border bg-background/95 p-4 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-[160ms] data-[state=closed]:duration-[110ms] data-[state=open]:ease-[var(--motion-ease-drawer)] data-[state=closed]:ease-[var(--motion-ease-out)]',
  {
    variants: {
      side: {
        top: 'inset-x-2 top-[calc(var(--native-safe-top)+0.5rem)] rounded-[var(--native-radius-sheet)] data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-2 bottom-[calc(var(--native-safe-bottom)+0.5rem)] rounded-[var(--native-radius-sheet)] pb-[calc(1rem+var(--native-safe-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'left-[calc(var(--native-safe-left)+0.5rem)] top-[calc(var(--native-safe-top)+0.5rem)] bottom-[calc(var(--native-safe-bottom)+0.5rem)] h-auto w-3/4 rounded-[var(--native-radius-sheet)] data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
        right:
          'right-[calc(var(--native-safe-right)+0.5rem)] top-[calc(var(--native-safe-top)+0.5rem)] bottom-[calc(var(--native-safe-bottom)+0.5rem)] h-auto w-3/4 rounded-[var(--native-radius-sheet)] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm'
      }
    },
    defaultVariants: {
      side: 'right'
    }
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = 'right', className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full bg-muted/70 text-muted-foreground opacity-80 ring-offset-background transition-[opacity,background-color,color] hover:bg-muted hover:text-foreground hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-2 text-center sm:text-left',
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-foreground', className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger
}
