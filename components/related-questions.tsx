'use client'

import { CHAT_ID } from '@/lib/constants'
import { JSONValue } from 'ai'
import { useChat } from 'ai/react'
import { ArrowRight, Repeat2 } from 'lucide-react'
import React from 'react'
import { CollapsibleMessage } from './collapsible-message'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'

export interface RelatedQuestionsProps {
  annotations: JSONValue[]
  onQuerySelect: (query: string) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

interface RelatedQuestionsAnnotation extends Record<string, JSONValue> {
  type: 'related-questions'
  data: {
    items: Array<{ query: string }>
  }
}

export const RelatedQuestions: React.FC<RelatedQuestionsProps> = ({
  annotations,
  onQuerySelect,
  isOpen,
  onOpenChange
}) => {
  const { isLoading } = useChat({
    id: CHAT_ID
  })

  if (!annotations) {
    return null
  }

  const lastRelatedQuestionsAnnotation = annotations[
    annotations.length - 1
  ] as RelatedQuestionsAnnotation

  const header = (
    <div className="flex items-center gap-1">
      <Repeat2 size={16} />
      <div>Related</div>
    </div>
  )

  const relatedQuestions = lastRelatedQuestionsAnnotation?.data
  if ((!relatedQuestions || !relatedQuestions.items) && !isLoading) {
    return null
  }

  if (relatedQuestions.items.length === 0 && isLoading) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      >
        <Skeleton className="w-full h-6" />
      </CollapsibleMessage>
    )
  }

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-wrap">
        {Array.isArray(relatedQuestions.items) ? (
          relatedQuestions.items
            ?.filter(item => item?.query !== '')
            .map((item, index) => (
              <div className="flex items-start w-full" key={index}>
                <ArrowRight className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-accent-foreground/50" />
                <Button
                  variant="link"
                  className="flex-1 justify-start px-0 py-1 h-fit font-semibold text-accent-foreground/50 whitespace-normal text-left"
                  type="submit"
                  name={'related_query'}
                  value={item?.query}
                  onClick={() => onQuerySelect(item?.query)}
                >
                  {item?.query}
                </Button>
              </div>
            ))
        ) : (
          <div>Not an array</div>
        )}
      </div>
    </CollapsibleMessage>
  )
}
export default RelatedQuestions
