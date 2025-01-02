'use client'

import { Section } from './section'
import { BotMessage } from './message'
import { DefaultSkeleton } from './default-skeleton'

export type AnswerSectionProps = {
  content: string
}

export function AnswerSection({ content }: AnswerSectionProps) {
  return (
    <div>
      <Section title="Answer">
        {content ? <BotMessage message={content} /> : <DefaultSkeleton />}
      </Section>
    </div>
  )
}
