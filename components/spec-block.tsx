'use client'

import { useMemo } from 'react'

import { ActionProvider, JSONUIProvider, Renderer } from '@json-render/react'
import { toast } from 'sonner'

import { captureClient, chatIdFromPath } from '@/lib/analytics/posthog-client'
import { useChatContext } from '@/lib/contexts/chat-context'
import { registry } from '@/lib/render/registry'
import type { SpecFenceResult } from '@/lib/render/spec-fence'

function currentChatId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return chatIdFromPath(window.location.pathname)
}

type SpecBlockProps = {
  result: SpecFenceResult
}

export function SpecBlock({ result }: SpecBlockProps) {
  const chatContext = useChatContext()

  const handlers = useMemo(
    () => ({
      submitQuery: (params: Record<string, unknown>) => {
        const query = (params as { query?: string }).query
        if (typeof query !== 'string' || !query.trim()) return

        // Reject clicks while a response is in flight. Firing a second
        // sendMessage mid-stream corrupts useChat's internal state and
        // leaves the input box stuck disabled. Read via the ref so the
        // frozen closure (ActionProvider stores handlers as
        // useState(initialHandlers)) still sees the latest value.
        if (chatContext.isStreamingRef.current) {
          toast.info('Please wait for the current response to finish.')
          return
        }

        captureClient('related_question_clicked', { chatId: currentChatId() })

        chatContext.sendMessage({
          role: 'user',
          parts: [{ type: 'text', text: query }]
        })
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
