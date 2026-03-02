import { cn } from '@/lib/utils'

interface ProcessRailProps {
  isFirst: boolean
  isLast: boolean
  isSubStep?: boolean
}

export function ProcessRail({
  isFirst,
  isLast,
  isSubStep = false
}: ProcessRailProps) {
  return (
    <div className="relative flex flex-col items-center w-5 h-full">
      {/* Connector line above */}
      {!isFirst && (
        <div className="absolute w-px bg-border/50 -top-full h-full" />
      )}

      {/* Dot positioned at header center - aligned with "Thoughts" text */}
      <div
        className={cn(
          'absolute rounded-full z-10',
          isSubStep
            ? 'h-1.5 w-1.5 bg-muted-foreground/50'
            : 'h-2 w-2 bg-muted-foreground'
        )}
        style={{ top: '0.5rem' }} // Align with header text baseline
      />

      {/* Connector line below */}
      {!isLast && (
        <div
          className="absolute w-px bg-border/50"
          style={{
            top: '1.125rem',
            bottom: '-100%',
            height: 'calc(100% + 100%)'
          }}
        />
      )}
    </div>
  )
}
