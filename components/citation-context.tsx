'use client'

import { createContext, ReactNode,useContext } from 'react'

import type { SearchResultItem } from '@/lib/types'

interface CitationContextValue {
  citationMap?: Record<number, SearchResultItem>
}

const CitationContext = createContext<CitationContextValue | undefined>(undefined)

export function CitationProvider({ 
  children, 
  citationMap
}: { 
  children: ReactNode
  citationMap?: Record<number, SearchResultItem>
}) {
  return (
    <CitationContext.Provider value={{ citationMap }}>
      {children}
    </CitationContext.Provider>
  )
}

export function useCitation() {
  const context = useContext(CitationContext)
  return context || { citationMap: undefined }
}