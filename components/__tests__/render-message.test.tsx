import React from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import { RenderMessage } from '../render-message'

vi.mock('../answer-section', () => ({
  AnswerSection: ({
    content,
    supportingContent
  }: {
    content: string
    supportingContent?: React.ReactNode
  }) => (
    <div data-testid="answer-section">
      {content}
      {supportingContent}
    </div>
  )
}))

vi.mock('../research-process-section', () => ({
  __esModule: true,
  default: ({ parts }: { parts: Array<{ type: string }> }) => (
    <div data-testid="research-process">
      {parts.map(part => part.type).join(',')}
    </div>
  )
}))

vi.mock('../dynamic-tool-display', () => ({
  DynamicToolDisplay: () => <div data-testid="dynamic-tool" />
}))

vi.mock('../sources/source-card-list', () => ({
  SourceCardList: ({ sources }: { sources: Array<{ title: string }> }) => (
    <div data-testid="source-card-list">
      {sources.map(source => source.title).join(',')}
    </div>
  )
}))

vi.mock('../gist/gist-module', () => ({
  GistModule: ({ sources }: { sources: Array<{ title: string }> }) => (
    <div data-testid="gist-module">
      {sources.map(source => source.title).join(',')}
    </div>
  )
}))

vi.mock('../user-file-section', () => ({
  UserFileSection: () => <div data-testid="user-file" />
}))

vi.mock('../user-text-section', () => ({
  UserTextSection: () => <div data-testid="user-text" />
}))

describe('RenderMessage', () => {
  test('ignores empty text parts so research process is not split early', () => {
    const message: UIMessage = {
      id: 'assistant-msg',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'First reasoning' } as any,
        {
          type: 'tool-search',
          toolCallId: 'tool-1',
          state: 'output-available',
          input: {},
          output: {}
        } as any,
        { type: 'text', text: '' } as any,
        { type: 'reasoning', text: 'Second reasoning' } as any,
        { type: 'text', text: 'Final answer' } as any
      ]
    } as UIMessage

    const { container } = render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => true}
        onOpenChange={() => {}}
      />
    )

    const processSections = screen.getAllByTestId('research-process')
    expect(processSections).toHaveLength(1)
    expect(processSections[0]).toHaveTextContent(
      'reasoning,tool-search,reasoning'
    )

    const answerSections = screen.getAllByTestId('answer-section')
    expect(answerSections).toHaveLength(1)
    expect(answerSections[0]).toHaveTextContent('Final answer')

    const order = Array.from(
      container.querySelectorAll(
        '[data-testid="research-process"], [data-testid="answer-section"]'
      )
    ).map(node => node.getAttribute('data-testid'))
    expect(order).toEqual(['research-process', 'answer-section'])
  })

  test('renders Gist before research and source cards inside the final answer stack', () => {
    const message: UIMessage = {
      id: 'assistant-msg',
      role: 'assistant',
      parts: [
        {
          type: 'tool-search',
          toolCallId: 'tool-1',
          state: 'output-available',
          input: { query: 'source first' },
          output: {
            state: 'complete',
            query: 'source first',
            images: [],
            results: [
              {
                title: 'Primary source',
                url: 'https://example.com/report',
                content: 'Search snippet'
              },
              {
                title: 'Secondary source',
                url: 'https://example.org/report',
                content: 'Second search snippet'
              }
            ]
          }
        } as any,
        { type: 'text', text: 'Final answer' } as any
      ]
    } as UIMessage

    const { container } = render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => true}
        onOpenChange={() => {}}
      />
    )

    expect(screen.getByTestId('gist-module')).toHaveTextContent(
      'Primary source,Secondary source'
    )
    expect(screen.getByTestId('source-card-list')).toHaveTextContent(
      'Primary source,Secondary source'
    )

    const order = Array.from(
      container.querySelectorAll(
        '[data-testid="research-process"], [data-testid="gist-module"], [data-testid="source-card-list"], [data-testid="answer-section"]'
      )
    ).map(node => node.getAttribute('data-testid'))
    expect(order).toEqual([
      'gist-module',
      'research-process',
      'answer-section',
      'source-card-list'
    ])
  })
})
