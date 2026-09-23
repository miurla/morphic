import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import { ChatMessages } from '../chat-messages'

vi.mock('@/lib/hooks/use-media-query', () => ({
  useMediaQuery: () => false
}))

vi.mock('../render-message', () => ({
  RenderMessage: ({
    message,
    getIsOpen,
    onOpenChange
  }: {
    message: UIMessage
    getIsOpen: (id: string, partType?: string, hasNextPart?: boolean) => boolean
    onOpenChange: (id: string, open: boolean) => void
  }) => {
    if (message.role !== 'assistant') return null

    const hasAnswer = message.parts?.some(
      part => part.type === 'text' && part.text.trim().length > 0
    )
    const isOpen = getIsOpen('tool-1', 'tool-search', hasAnswer)

    return (
      <button onClick={() => onOpenChange('tool-1', !isOpen)}>
        {isOpen ? 'Open tool' : 'Closed tool'}
      </button>
    )
  }
}))

vi.mock('../ui/animated-logo', () => ({
  AnimatedLogo: () => null
}))

vi.mock('../chat-footer-message', () => ({
  ChatFooterMessage: () => null
}))

test('closes a single tool when answer text starts streaming', () => {
  const userMessage = {
    id: 'user-1',
    role: 'user',
    parts: [{ type: 'text', text: 'Question' }]
  } as UIMessage
  const toolPart = {
    type: 'tool-search',
    toolCallId: 'tool-1',
    state: 'output-available',
    input: {},
    output: {}
  } as UIMessage['parts'][number]
  const assistantMessage = (answer?: string): UIMessage => ({
    id: 'assistant-1',
    role: 'assistant',
    parts: answer ? [toolPart, { type: 'text', text: answer }] : [toolPart]
  })
  const scrollContainerRef = React.createRef<HTMLDivElement>()
  const sections = (answer?: string) => [
    {
      id: 'section-1',
      userMessage,
      assistantMessages: [assistantMessage(answer)]
    }
  ]

  const { rerender } = render(
    <ChatMessages
      sections={sections()}
      status="streaming"
      scrollContainerRef={scrollContainerRef}
    />
  )

  expect(screen.getByRole('button', { name: 'Open tool' })).toBeInTheDocument()

  rerender(
    <ChatMessages
      sections={sections('Answer has started')}
      status="streaming"
      scrollContainerRef={scrollContainerRef}
    />
  )

  const closedTool = screen.getByRole('button', { name: 'Closed tool' })
  fireEvent.click(closedTool)
  expect(screen.getByRole('button', { name: 'Open tool' })).toBeInTheDocument()
})
