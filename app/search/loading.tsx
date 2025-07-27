'use client'

import { DefaultSkeleton } from '../../components/default-skeleton'

export default function Loading() {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-center">
      <div className="w-full max-w-3xl px-4 pt-12">
        <DefaultSkeleton />
      </div>
    </div>
  )
}
