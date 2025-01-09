'use client'

import { BotMessage } from './message'
import { DefaultSkeleton } from './default-skeleton'
import { CollapsibleMessage } from './collapsible-message'
import { Text } from 'lucide-react'

export type AnswerSectionProps = {
  content: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function AnswerSection({
  content,
  isOpen,
  onOpenChange
}: AnswerSectionProps) {
  const header = (
    <div className="flex items-center gap-1">
      <Text size={16} />
      <div>Answer</div>
    </div>
  )
  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showBorder={false}
    >
      {content ? <BotMessage message={content} /> : <DefaultSkeleton />}
    </CollapsibleMessage>
  )
}
