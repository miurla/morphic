'use client'

import React from 'react'
import { Skeleton } from './ui/skeleton'

export const SearchSkeleton = () => {
  return (
    <div>
      <Skeleton className="h-6 w-48" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="w-[calc(50%-0.5rem)] md:w-[calc(25%-0.5rem)] p-2"
            key={index}
          >
            <div className="flex-1">
              <div className="pt-2">
                <Skeleton className="h-6 mb-2" />
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="w-24 h-4" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
