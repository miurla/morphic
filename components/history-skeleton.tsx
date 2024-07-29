import React from 'react'
import { Skeleton } from './ui/skeleton'

export function HistorySkeleton() {
  return (
    <div className="flex flex-col flex-1 space-y-1.5 overflow-auto">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="w-full h-12 rounded" />
      ))}
    </div>
  )
}
