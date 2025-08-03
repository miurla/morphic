'use client'


import rehypeExternalLinks from 'rehype-external-links'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import type { SearchResultItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { processCitations } from '@/lib/utils/citation'

import { CodeBlock } from './ui/codeblock'
import { MemoizedReactMarkdown } from './ui/markdown'
import { CitationProvider } from './citation-context'
import { Citing } from './custom-link'

import 'katex/dist/katex.min.css'

export function BotMessage({
  message,
  className,
  citationMap
}: {
  message: string
  className?: string
  citationMap?: Record<number, SearchResultItem>
}) {
  // Process citations to replace [number](#) with [number](actual-url)
  const processedMessage = processCitations(message || '', citationMap)
  
  // Check if the content contains LaTeX patterns
  const containsLaTeX = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/.test(
    processedMessage
  )

  // Modify the content to render LaTeX equations if LaTeX patterns are found
  const processedData = preprocessLaTeX(processedMessage)

  // Define custom components
  const customComponents = {
    code(props: any) {
      const { children, className, ...rest } = props
      const inline = !('data-language' in props)
      
      if (children && typeof children === 'string') {
        if (children === '▍') {
          return (
            <span className="mt-1 cursor-default animate-pulse">▍</span>
          )
        }

        const processedChildren = children.replace('`▍`', '▍')
        const match = /language-(\w+)/.exec(className || '')

        if (inline) {
          return (
            <code className={className} {...rest}>
              {processedChildren}
            </code>
          )
        }

        return (
          <CodeBlock
            key={Math.random()}
            language={(match && match[1]) || ''}
            value={processedChildren.replace(/\n$/, '')}
            {...rest}
          />
        )
      }

      return (
        <code className={className} {...rest}>
          {children}
        </code>
      )
    },
    a: Citing
  }

  if (containsLaTeX) {
    return (
      <CitationProvider citationMap={citationMap}>
        <div className={cn(
          'prose-sm prose-neutral prose-a:text-accent-foreground/50',
          className
        )}>
          <MemoizedReactMarkdown
            rehypePlugins={[
              [rehypeExternalLinks, { target: '_blank' }],
              [rehypeKatex]
            ]}
            remarkPlugins={[remarkGfm, remarkMath]}
            components={{
              a: Citing,
              code: customComponents.code
            }}
          >
            {processedData}
          </MemoizedReactMarkdown>
        </div>
      </CitationProvider>
    )
  }

  return (
    <CitationProvider citationMap={citationMap}>
      <div className={cn(
        'prose-sm prose-neutral prose-a:text-accent-foreground/50',
        className
      )}>
        <MemoizedReactMarkdown
          rehypePlugins={[[rehypeExternalLinks, { target: '_blank' }]]}
          remarkPlugins={[remarkGfm]}
          components={customComponents}
        >
          {processedMessage}
        </MemoizedReactMarkdown>
      </div>
    </CitationProvider>
  )
}

// Preprocess LaTeX equations to be rendered by KaTeX
// ref: https://github.com/remarkjs/react-markdown/issues/785
const preprocessLaTeX = (content: string) => {
  const blockProcessedContent = content.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_, equation) => `$$${equation}$$`
  )
  const inlineProcessedContent = blockProcessedContent.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_, equation) => `$${equation}$`
  )
  return inlineProcessedContent
}
