import { cn } from '@/lib/utils'
import { AnchorHTMLAttributes, DetailedHTMLProps, ReactNode } from 'react'

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
  const childrenText = children?.toString() || ''
  const isNumber = /^\d+$/.test(childrenText)
  const linkClasses = cn(
    isNumber
      ? 'text-[10px] bg-muted text-muted-froreground rounded-full w-4 h-4 px-0.5 inline-flex items-center justify-center hover:bg-muted/50 duration-200 no-underline -translate-y-0.5'
      : 'hover:underline inline-flex items-center gap-1.5',
    className
  )

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClasses}
      {...props}
    >
      {children}
    </a>
  )
}
