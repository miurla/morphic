'use client'

import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

import { MemoizedReactMarkdown } from '../ui/markdown'

export function ReasoningContent({ reasoning }: { reasoning: string }) {
  return (
    <div className="overflow-auto">
      <div className={cn('prose-sm dark:prose-invert max-w-none')}>
        <MemoizedReactMarkdown remarkPlugins={[remarkGfm]}>
          {reasoning}
        </MemoizedReactMarkdown>
      </div>
    </div>
  )
}
