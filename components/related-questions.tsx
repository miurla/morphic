'use client'

import React from 'react'
import { Button } from './ui/button'
import { ArrowRight } from 'lucide-react'
import { Section } from './section'
import { Skeleton } from './ui/skeleton'
import { JSONValue } from 'ai'
import { MessageWithAvatar } from './message-with-avatar'

export interface RelatedQuestionsProps {
  annotations: JSONValue[]
  onQuerySelect: (query: string) => void
}

interface RelatedQuestionsAnnotation extends Record<string, JSONValue> {
  type: 'related-questions'
  relatedQuestions: {
    items: Array<{ query: string }>
  }
  status: 'loading' | 'done'
}

export const RelatedQuestions: React.FC<RelatedQuestionsProps> = ({
  annotations,
  onQuerySelect
}) => {
  if (!annotations) {
    return null
  }

  const lastRelatedQuestionsAnnotation = annotations.find(
    (a): a is RelatedQuestionsAnnotation =>
      a !== null &&
      typeof a === 'object' &&
      'type' in a &&
      a.type === 'related-questions' &&
      a.status === 'done'
  )

  const relatedQuestions = lastRelatedQuestionsAnnotation?.relatedQuestions
  if (!relatedQuestions) {
    return (
      <MessageWithAvatar role="assistant">
        <Section title="Related" separator={true}>
          <Skeleton className="w-full h-6" />
        </Section>
      </MessageWithAvatar>
    )
  }

  return (
    <MessageWithAvatar role="assistant">
      <Section title="Related" separator={true}>
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
      </Section>
    </MessageWithAvatar>
  )
}
export default RelatedQuestions
