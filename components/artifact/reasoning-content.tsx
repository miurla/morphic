'use client'

import { cn } from '@/lib/utils'
import remarkGfm from 'remark-gfm'
import { MemoizedReactMarkdown } from '../ui/markdown'

export function ReasoningContent({ reasoning }: { reasoning: string }) {
  return (
    <div className="p-4 overflow-auto">
      <h3 className="text-lg font-semibold mb-2">Reasoning</h3>
      <div className={cn('prose prose-sm dark:prose-invert max-w-none')}>
        <MemoizedReactMarkdown remarkPlugins={[remarkGfm]}>
          {reasoning}
        </MemoizedReactMarkdown>
      </div>
    </div>
  )
}
