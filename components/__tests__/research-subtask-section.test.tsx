import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ResearchSubtaskSection } from '../research-subtask-section'

describe('ResearchSubtaskSection', () => {
  it('renders sub-agent role, model, parent model, and route metadata', () => {
    render(
      <ResearchSubtaskSection
        tool={
          {
            type: 'tool-researchSubtask',
            toolCallId: 'call_subtask',
            state: 'output-available',
            input: {
              task: 'Analyze evidence graph patterns',
              agentRole: 'verification-analyst'
            },
            output: {
              task: 'Analyze evidence graph patterns',
              agentId: 'subagent_abc123',
              agentRole: 'verification-analyst',
              model: 'google:gemini-2.5-flash',
              parentModel: 'openai:gpt-5-mini',
              routing: 'role-route',
              notes: 'Verification notes'
            }
          } as any
        }
        isOpen
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.getAllByText(/verification-analyst/).length).toBeGreaterThan(
      0
    )
    expect(screen.getByText('subagent_abc123')).toBeInTheDocument()
    expect(screen.getByText('google:gemini-2.5-flash')).toBeInTheDocument()
    expect(screen.getByText('openai:gpt-5-mini')).toBeInTheDocument()
    expect(screen.getByText('role-route')).toBeInTheDocument()
    expect(screen.getByText('Verification notes')).toBeInTheDocument()
  })

  it('renders duplicate-skip metadata', () => {
    render(
      <ResearchSubtaskSection
        tool={
          {
            type: 'tool-researchSubtask',
            toolCallId: 'call_subtask_duplicate',
            state: 'output-available',
            input: {
              task: 'Return notes on podcast transcript ingestion',
              agentRole: 'feed-analyst'
            },
            output: {
              task: 'Return notes on podcast transcript ingestion',
              agentId: 'subagent_duplicate',
              agentRole: 'feed-analyst',
              model: 'openai:gpt-5-mini',
              parentModel: 'openai:gpt-5-mini',
              routing: 'role-route',
              skippedDuplicate: true,
              duplicateOf:
                'Produce notes on RSS and podcast transcript ingestion',
              notes: 'Skipped near-duplicate sub-agent task.'
            }
          } as any
        }
        isOpen
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.getByText('Skipped')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Duplicate of Produce notes on RSS and podcast transcript ingestion/
      )
    ).toBeInTheDocument()
  })
})
