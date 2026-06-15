import { ReactNode } from 'react'



interface StatusIndicatorProps {
  icon: React.ComponentType<any>
  iconClassName?: string
  children?: ReactNode
}

export function StatusIndicator({
  icon: Icon,
  iconClassName,
  children
}: StatusIndicatorProps) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground text-xs">
      <Icon width={16} height={16} className={iconClassName} />
      {children && <span>{children}</span>}
    </span>
  )
}
