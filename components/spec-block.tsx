'use client'

import { useMemo } from 'react'

import { ActionProvider, JSONUIProvider, Renderer } from '@json-render/react'

import { useChatContext } from '@/lib/contexts/chat-context'
import { registry } from '@/lib/render/registry'
import type { SpecFenceResult } from '@/lib/render/spec-fence'

type SpecBlockProps = {
  result: SpecFenceResult
}

export function SpecBlock({ result }: SpecBlockProps) {
  const chatContext = useChatContext()

  const handlers = useMemo(
    () => ({
      submitQuery: (params: Record<string, unknown>) => {
        const query = (params as { query?: string }).query
        if (typeof query === 'string' && query.trim()) {
          chatContext.sendMessage({
            role: 'user',
            parts: [{ type: 'text', text: query }]
          })
        }
      }
    }),
    [chatContext]
  )

  const content = useMemo(() => {
    if (result.status !== 'ready') {
      return null
    }

    if (!result.spec.root || !result.spec.elements) {
      return null
    }

    return (
      <div className="pt-2 pb-4">
        <JSONUIProvider registry={registry} initialState={result.spec.state}>
          <ActionProvider handlers={handlers}>
            <Renderer spec={result.spec} registry={registry} />
          </ActionProvider>
        </JSONUIProvider>
      </div>
    )
  }, [result, handlers])

  return content
}
