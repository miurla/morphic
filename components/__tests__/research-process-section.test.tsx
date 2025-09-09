import React from 'react'

import type { ReasoningPart } from '@ai-sdk/provider-utils'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, Mock, test, vi } from 'vitest'

import type { ToolPart, UIMessage } from '@/lib/types/ai'

import { ResearchProcessSection } from '../research-process-section'

// Mock the child components
vi.mock('../reasoning-section', () => ({
  ReasoningSection: ({ content, isOpen, onOpenChange }: any) => (
    <div data-testid="reasoning-section">
      <button onClick={() => onOpenChange(!isOpen)}>
        {isOpen ? 'Close' : 'Open'} Reasoning
      </button>
      {isOpen && <div>{content.reasoning}</div>}
    </div>
  )
}))

vi.mock('../tool-section', () => ({
  ToolSection: ({ tool, isOpen, onOpenChange }: any) => (
    <div data-testid="tool-section">
      <button onClick={() => onOpenChange(!isOpen)}>
        {isOpen ? 'Close' : 'Open'} Tool
      </button>
      {isOpen && <div>{tool.type}</div>}
    </div>
  )
}))

describe('ResearchProcessSection', () => {
  const mockGetIsOpen = vi.fn()
  const mockOnOpenChange = vi.fn()
  const mockOnQuerySelect = vi.fn()
  const mockAddToolResult = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetIsOpen.mockReturnValue(false)
  })

  describe('Type Guards', () => {
    test('correctly identifies reasoning parts', () => {
      const reasoningPart: ReasoningPart = {
        type: 'reasoning',
        text: 'Test reasoning'
      }

      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts: [reasoningPart]
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-1"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      expect(screen.getByTestId('reasoning-section')).toBeInTheDocument()
    })

    test('correctly identifies tool parts', () => {
      const toolPart: ToolPart = {
        type: 'tool-search',
        toolCallId: 'tool-1',
        input: {},
        state: 'output-available'
      }

      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts: [toolPart]
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-2"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      expect(screen.getByTestId('tool-section')).toBeInTheDocument()
    })

    test('filters out empty reasoning parts', () => {
      const emptyReasoningPart: ReasoningPart = {
        type: 'reasoning',
        text: ''
      }

      const validReasoningPart: ReasoningPart = {
        type: 'reasoning',
        text: 'Valid reasoning'
      }

      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts: [emptyReasoningPart, validReasoningPart]
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-3"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      // Should only render one reasoning section (the valid one)
      const reasoningSections = screen.getAllByTestId('reasoning-section')
      expect(reasoningSections).toHaveLength(1)
    })
  })

  describe('Segmentation Logic', () => {
    test('splits parts by text correctly', () => {
      const parts = [
        { type: 'reasoning', text: 'First reasoning' } as ReasoningPart,
        {
          type: 'tool-search',
          toolCallId: 'tool-1',
          input: {},
          state: 'output-available'
        } as ToolPart,
        { type: 'text', text: 'Text separator' },
        { type: 'reasoning', text: 'Second reasoning' } as ReasoningPart
      ]

      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-4"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      // Should render 3 sections (2 reasoning + 1 tool, split by text)
      const allSections = [
        ...screen.getAllByTestId('reasoning-section'),
        ...screen.getAllByTestId('tool-section')
      ]
      expect(allSections).toHaveLength(3)
    })

    test('groups consecutive tool parts of same type', () => {
      const parts = [
        {
          type: 'tool-search',
          toolCallId: 'tool-1',
          input: {},
          state: 'output-available'
        } as ToolPart,
        {
          type: 'tool-search',
          toolCallId: 'tool-2',
          input: {},
          state: 'output-available'
        } as ToolPart,
        {
          type: 'tool-fetch',
          toolCallId: 'tool-3',
          input: {},
          state: 'output-available'
        } as ToolPart
      ]

      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-5"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      const toolSections = screen.getAllByTestId('tool-section')
      expect(toolSections).toHaveLength(3)
    })
  })

  describe('Accordion Behavior', () => {
    test('handles accordion state for grouped sections', () => {
      const parts = [
        { type: 'reasoning', text: 'First' } as ReasoningPart,
        { type: 'reasoning', text: 'Second' } as ReasoningPart
      ]

      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts
      }

      const { rerender } = render(
        <ResearchProcessSection
          message={message}
          messageId="test-6"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      const buttons = screen.getAllByRole('button')

      // Click first button to open
      fireEvent.click(buttons[0])

      // Should call onOpenChange
      expect(mockOnOpenChange).toHaveBeenCalled()

      // Update mock to return true for the clicked item
      mockGetIsOpen.mockImplementation(id => id.includes('reasoning-0-0-0'))

      rerender(
        <ResearchProcessSection
          message={message}
          messageId="test-6"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )
    })

    test('handles single sections differently from grouped sections', () => {
      const singlePart = [
        { type: 'reasoning', text: 'Single reasoning' } as ReasoningPart
      ]

      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts: singlePart
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-7"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // For single sections, should directly call onOpenChange
      expect(mockOnOpenChange).toHaveBeenCalledWith(
        expect.stringContaining('reasoning'),
        true
      )
    })
  })

  describe('Subsequent Content Detection', () => {
    test('detects subsequent content correctly', () => {
      const parts = [
        { type: 'reasoning', text: 'First' } as ReasoningPart,
        { type: 'text', text: 'Text' },
        { type: 'reasoning', text: 'Second' } as ReasoningPart
      ]

      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-8"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      // The first reasoning should detect subsequent content (the text part)
      expect(mockGetIsOpen).toHaveBeenCalledWith(
        expect.stringContaining('reasoning'),
        'reasoning',
        true // hasSubsequentContent should be true
      )
    })
  })

  describe('Edge Cases', () => {
    test('returns null for empty segments', () => {
      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts: []
      }

      const { container } = render(
        <ResearchProcessSection
          message={message}
          messageId="test-9"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    test('handles parts override correctly', () => {
      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts: [{ type: 'reasoning', text: 'Original' } as ReasoningPart]
      }

      const overrideParts = [
        { type: 'reasoning', text: 'Override' } as ReasoningPart
      ]

      // Mock getIsOpen to return true so content is visible
      mockGetIsOpen.mockReturnValue(true)

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-10"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
          parts={overrideParts}
        />
      )

      // Should use override parts
      expect(screen.getByTestId('reasoning-section')).toBeInTheDocument()
      // The content should show "Override" when open
      expect(screen.getByText('Override')).toBeInTheDocument()
    })

    test('handles data parts correctly', () => {
      const parts = [{ type: 'data-test', data: 'test' }]

      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts
      }

      const { container } = render(
        <ResearchProcessSection
          message={message}
          messageId="test-11"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      // Data parts should not render anything
      expect(
        container.firstChild?.firstChild?.firstChild?.firstChild
      ).toBeNull()
    })
  })

  describe('Props Handling', () => {
    test('passes status prop correctly', () => {
      const toolPart: ToolPart = {
        type: 'tool-search',
        toolCallId: 'tool-1',
        input: {},
        state: 'output-available'
      }

      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts: [toolPart]
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-12"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
          status="streaming"
        />
      )

      expect(screen.getByTestId('tool-section')).toBeInTheDocument()
    })

    test('passes addToolResult prop correctly', () => {
      const toolPart: ToolPart = {
        type: 'tool-search',
        toolCallId: 'tool-1',
        input: {},
        state: 'output-available'
      }

      const message: UIMessage = {
        role: 'assistant',
        content: '',
        parts: [toolPart]
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-13"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
          addToolResult={mockAddToolResult}
        />
      )

      expect(screen.getByTestId('tool-section')).toBeInTheDocument()
    })
  })
})
