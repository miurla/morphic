'use client'

import React from 'react'

import { UseChatHelpers } from '@ai-sdk/react'
import { ArrowRight } from 'lucide-react'

import { Related } from '@/lib/schema/related'
import type { ToolPart, UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'

import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { CollapsibleMessage } from './collapsible-message'
import { Section } from './section'

export interface RelatedQuestionsProps {
  tool: ToolPart
  onQuerySelect: (query: string) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
}

export const RelatedQuestions: React.FC<RelatedQuestionsProps> = ({
  tool,
  onQuerySelect,
  isOpen,
  onOpenChange,
  status
}) => {
  const isLoading =
    status === 'submitted' ||
    status === 'streaming' ||
    tool.state === 'input-streaming' ||
    tool.state === 'input-available'

  const data: Related | undefined =
    tool.state === 'output-available' ? tool.output : undefined

  if (!data && isLoading) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={false}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <Section title="Related" className="pt-0 pb-4">
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((_, index) => (
              <div className="flex items-start w-full" key={index}>
                <ArrowRight className="h-4 w-4 mr-2 mt-1.5 flex-shrink-0 text-accent-foreground/50" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))}
          </div>
        </Section>
      </CollapsibleMessage>
    )
  }

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={false}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
      showBorder={false}
    >
      <Section title="Related" className="pt-0 pb-4">
        <div className="flex flex-col">
          {Array.isArray(data?.questions) ? (
            data.questions.map((item, index) => (
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
            ))
          ) : (
            <div>Not an array</div>
          )}
        </div>
      </Section>
    </CollapsibleMessage>
  )
}
export default RelatedQuestions
