import { Skeleton } from '@/components/ui/skeleton'

/**
 * Placeholder matching the version footer's two-line height so the sidebar
 * footer area does not shift when the footer streams in after a cold update
 * check.
 */
export function VersionFooterSkeleton() {
  return (
    <div className="text-xs text-center space-y-0.5">
      <div className="flex justify-center">
        <Skeleton className="h-4 w-14" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  )
}
