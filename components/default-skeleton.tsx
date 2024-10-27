'use client'

import React from 'react'
import { Skeleton } from './ui/skeleton'

export const DefaultSkeleton = () => {
  return (
    <div className="flex flex-col gap-2 pb-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="w-full h-6" />
    </div>
  )
}
