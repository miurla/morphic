'use client'

import { Section } from './section'
import { BotMessage } from './message'
import { DefaultSkeleton } from './default-skeleton'
import { MessageWithAvatar } from './message-with-avatar'

export type AnswerSectionProps = {
  content: string
}

export function AnswerSection({ content }: AnswerSectionProps) {
  return (
    <MessageWithAvatar role="assistant">
      <Section title="Answer">
        {content ? <BotMessage message={content} /> : <DefaultSkeleton />}
      </Section>
    </MessageWithAvatar>
  )
}
