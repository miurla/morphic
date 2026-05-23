'use client'

import { Skeleton } from './ui/skeleton'

export const DefaultSkeleton = () => {
  return (
    <div className="flex flex-col gap-2 pb-4 pt-2">
      {[...Array(2)].map((_, index) => (
        <Skeleton key={index} className="h-6 w-full" />
      ))}
    </div>
  )
}

export function SearchSkeleton() {
  return (
    <div className="py-2">
      <div className="mb-2 inline-flex h-5 items-center gap-1.5 rounded-full bg-secondary px-2">
        <Skeleton className="size-4 rounded-sm bg-muted-foreground/20" />
        <Skeleton className="h-3 w-12 bg-muted-foreground/20" />
      </div>
      <div className="flex flex-col gap-1 pb-0.5 md:-m-1 md:flex-row md:flex-wrap md:gap-0">
        {[...Array(4)].map((_, index) => (
          <div className="min-w-0 md:w-1/4 md:p-1" key={index}>
            <div className="rounded-md border bg-card p-2">
              <div className="flex min-w-0 items-center justify-between gap-2 md:flex-col md:items-stretch">
                <div className="min-w-0 flex-1 md:min-h-8 md:space-y-1">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="hidden h-3 w-2/3 md:block" />
                </div>
                <div className="flex max-w-[42%] min-w-0 shrink-0 items-center gap-1 rounded-sm bg-muted/50 px-1 py-0.5 md:hidden">
                  <Skeleton className="size-4 shrink-0 rounded-full bg-muted-foreground/20" />
                  <Skeleton className="h-3 min-w-8 flex-1 bg-muted-foreground/20" />
                </div>
                <div className="hidden min-w-0 items-center gap-1 rounded-sm bg-muted/50 px-1 py-0.5 md:mt-2 md:flex">
                  <Skeleton className="size-4 shrink-0 rounded-full bg-muted-foreground/20" />
                  <Skeleton className="h-3 w-16 bg-muted-foreground/20" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
