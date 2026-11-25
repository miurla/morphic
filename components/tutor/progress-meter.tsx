import { cn } from '@/lib/utils'

export function ProgressMeter({
  value,
  label,
  className
}: {
  value: number
  label: string
  className?: string
}) {
  const percentage = Math.max(
    0,
    Math.min(100, Math.round(Number.isFinite(value) ? value : 0))
  )
  return (
    <div
      className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
    >
      <div
        className="h-full rounded-full bg-foreground transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
