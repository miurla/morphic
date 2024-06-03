'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Section } from './section'
import { StreamableValue, useStreamableValue } from 'ai/rsc'
import { BotMessage } from './message'

export type AnswerSectionProps = {
  result?: StreamableValue<string>
}

export function AnswerSection({ result }: AnswerSectionProps) {
  const [data, error, pending] = useStreamableValue(result)
  return (
    <div>
      {data && data.length > 0 ? (
        <Section title="Answer">
          <BotMessage content={data} />
        </Section>
      ) : (
        <div className="flex flex-col gap-2 py-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="w-full h-6" />
        </div>
      )}
    </div>
  )
}
