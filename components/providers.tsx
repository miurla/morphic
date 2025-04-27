'use client'

import { useAppStore } from '@/lib/store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import React, { useEffect, useState } from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {
  // Create a new QueryClient instance for each session
  // (ensures data isolation between users/requests)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Configure default query behavior if needed
            staleTime: 5 * 60 * 1000 // 5 minutes
          }
        }
      })
  )

  // Expose store to window for debugging in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '[Providers] Exposing Zustand store to window.useAppStore for debugging.'
      )
      ;(window as any).useAppStore = useAppStore
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Optional: Adds DevTools for debugging React Query in development */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
