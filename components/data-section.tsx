'use client'

import React from 'react'

import { RelatedQuestions } from './related-questions'

interface DataSectionProps {
  part: {
    type: string
    data: any
    id?: string
  }
  onQuerySelect?: (query: string) => void
}

export function DataSection({ part, onQuerySelect }: DataSectionProps) {
  switch (part.type) {
    case 'data-relatedQuestions':
      if (onQuerySelect) {
        return (
          <RelatedQuestions data={part.data} onQuerySelect={onQuerySelect} />
        )
      }
      return null

    default:
      return null
  }
}
