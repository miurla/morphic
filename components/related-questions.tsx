'use client'

import React from 'react'

import { ArrowRight } from 'lucide-react'

import { Button } from './ui/button'
import { CollapsibleMessage } from './collapsible-message'
import { Section } from './section'

interface RelatedQuestionsProps {
  questions: Array<{ question: string }>
  onQuerySelect: (query: string) => void
}

export const RelatedQuestions: React.FC<RelatedQuestionsProps> = ({
  questions,
  onQuerySelect
}) => {
  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={false}
      isOpen={true}
      onOpenChange={() => {}}
      showIcon={false}
      showBorder={false}
    >
      <Section title="Related" className="pt-0 pb-4">
        <div className="flex flex-col">
          {questions.map((item, index) => (
            <div className="flex items-start w-full" key={index}>
              <ArrowRight className="h-4 w-4 mr-2 mt-1.5 flex-shrink-0 text-accent-foreground/50" />
              <Button
                variant="link"
                className="flex-1 justify-start px-0 py-1 h-fit font-semibold text-accent-foreground/50 whitespace-normal text-left"
                type="submit"
                name={'related_query'}
                value={item.question}
                onClick={() => onQuerySelect(item.question)}
              >
                {item.question}
              </Button>
            </div>
          ))}
        </div>
      </Section>
    </CollapsibleMessage>
  )
}

export default RelatedQuestions
