'use client'

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef
} from 'react'

import { ActionProvider, JSONUIProvider, Renderer } from '@json-render/react'
import { toast } from 'sonner'

import { captureClient, chatIdFromPath } from '@/lib/analytics/posthog-client'
import { useChatContext } from '@/lib/contexts/chat-context'
import { reviseQuery } from '@/lib/draft/revise'
import { registry } from '@/lib/render/registry'
import { prepareRevisionSuggestions } from '@/lib/render/revise-suggestions'
import type { SpecFenceResult } from '@/lib/render/spec-fence'

function currentChatId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return chatIdFromPath(window.location.pathname)
}

export const SpecMessageContext = createContext<string | undefined>(undefined)

type SpecBlockProps = {
  result: SpecFenceResult
}

export function SpecBlock({ result }: SpecBlockProps) {
  const chatContext = useChatContext()
  const messageId = useContext(SpecMessageContext)
  const prepared = useMemo(
    () =>
      result.status === 'ready'
        ? prepareRevisionSuggestions(result.spec)
        : null,
    [result]
  )
  const latest = useRef({ prepared, messageId, chatContext })
  useLayoutEffect(() => {
    latest.current = { prepared, messageId, chatContext }
  }, [prepared, messageId, chatContext])
  const shown = useRef(new Set<string>())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!messageId || !prepared?.suggestions.length) return
    const recordShown = () => {
      for (const suggestion of prepared?.suggestions ?? []) {
        const key = `${messageId}:${suggestion.suggestionId}:${suggestion.intent}`
        if (shown.current.has(key)) continue
        shown.current.add(key)
        captureClient('revise_suggestion_shown', {
          chatId: currentChatId(),
          messageId,
          suggestionId: suggestion.suggestionId,
          position: suggestion.position,
          intent: suggestion.intent
        })
      }
    }
    const container = containerRef.current
    if (!container) return
    if (typeof IntersectionObserver === 'undefined') {
      recordShown()
      return
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) recordShown()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [prepared, messageId])

  const handlers = useMemo(
    () => ({
      submitQuery: (params: Record<string, unknown>) => {
        const { prepared, messageId, chatContext } = latest.current
        const query = params.query
        if (typeof query !== 'string' || !query.trim()) return
        const position = params.position
        const suggestion =
          typeof position === 'number'
            ? prepared?.suggestions[position]
            : undefined
        // Ignore an obsolete prepared button instead of submitting a different slot.
        if (
          position !== undefined &&
          (!suggestion || suggestion.query !== query)
        )
          return
        if (chatContext.isStreamingRef.current) {
          toast.info('Please wait for the current response to finish.')
          return
        }
        if (!suggestion)
          captureClient('related_question_clicked', { chatId: currentChatId() })
        chatContext.sendMessage(
          {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: suggestion ? reviseQuery(query, suggestion.intent) : query
              }
            ]
          },
          () => {
            if (suggestion && messageId)
              captureClient('revise_suggestion_clicked', {
                chatId: currentChatId(),
                messageId,
                suggestionId: suggestion.suggestionId,
                position: suggestion.position,
                intent: suggestion.intent
              })
          }
        )
      }
    }),
    []
  )

  const content = useMemo(() => {
    if (result.status !== 'ready') {
      return null
    }

    if (!result.spec.root || !result.spec.elements) {
      return null
    }

    return (
      <div ref={containerRef} className="pt-2 pb-4">
        <JSONUIProvider registry={registry} initialState={result.spec.state}>
          <ActionProvider handlers={handlers}>
            <Renderer
              spec={prepared?.spec ?? result.spec}
              registry={registry}
            />
          </ActionProvider>
        </JSONUIProvider>
      </div>
    )
  }, [result, handlers, prepared])

  return content
}
