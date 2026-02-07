'use client'

import { createContext, ReactNode, useContext } from 'react'

import type { SearchResultItem } from '@/lib/types'

interface CitationContextValue {
  citationMaps?: Record<string, Record<number, SearchResultItem>>
}

const CitationContext = createContext<CitationContextValue | undefined>(
  undefined
)

export function CitationProvider({
  children,
  citationMaps
}: {
  children: ReactNode
  citationMaps?: Record<string, Record<number, SearchResultItem>>
}) {
  return (
    <CitationContext.Provider value={{ citationMaps }}>
      {children}
    </CitationContext.Provider>
  )
}

export function useCitation() {
  const context = useContext(CitationContext)
  return context || { citationMaps: undefined }
}
