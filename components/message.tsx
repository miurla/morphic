'use client'

import { StreamableValue, useStreamableValue } from 'ai/rsc'
import { MemoizedReactMarkdown } from './ui/markdown'

export function BotMessage({
  content
}: {
  content: string | StreamableValue<string>
}) {
  const [data, error, pending] = useStreamableValue(content)

  // Currently, sometimes error occurs after finishing the stream.
  if (error) return <div>Error</div>

  return (
    <MemoizedReactMarkdown className="prose-sm prose-neutral prose-a:text-accent-foreground/50">
      {data}
    </MemoizedReactMarkdown>
  )
}
