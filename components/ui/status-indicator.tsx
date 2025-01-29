import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface StatusIndicatorProps {
  icon: LucideIcon
  iconClassName?: string
  children: ReactNode
}

export function StatusIndicator({
  icon: Icon,
  iconClassName,
  children
}: StatusIndicatorProps) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground text-xs">
      <Icon size={16} className={iconClassName} />
      <span>{children}</span>
    </span>
  )
}
