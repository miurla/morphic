import { describe, expect, it } from 'vitest'

import {
  mapDBPartToUIMessagePart,
  mapUIMessagePartsToDBParts
} from '../message-mapping'

describe('message persistence mapping', () => {
  it('persists Google Fact Check tool output so Phase 8 evidence survives reloads', () => {
    const [mappedPart] = mapUIMessagePartsToDBParts(
      [
        {
          type: 'tool-googleFactCheck',
          toolCallId: 'call_factcheck',
          state: 'output-available',
          input: { query: 'The Earth is flat.' },
          output: {
            state: 'complete',
            query: 'The Earth is flat.',
            claims: [
              {
                text: 'The Earth is flat.',
                claimReview: [
                  {
                    publisher: { name: 'Science Check' },
                    url: 'https://sciencecheck.org/flat-earth',
                    textualRating: 'False'
                  }
                ]
              }
            ]
          }
        }
      ] as any[],
      'message_1'
    )

    expect(mappedPart).toMatchObject({
      type: 'tool-googleFactCheck',
      tool_toolCallId: 'call_factcheck',
      tool_state: 'output-available',
      tool_dynamic_name: 'googleFactCheck',
      tool_dynamic_type: 'tool',
      tool_dynamic_input: { query: 'The Earth is flat.' },
      tool_dynamic_output: {
        state: 'complete',
        query: 'The Earth is flat.'
      }
    })

    expect(mapDBPartToUIMessagePart(mappedPart as any)).toEqual({
      type: 'tool-googleFactCheck',
      state: 'output-available',
      toolCallId: 'call_factcheck',
      input: { query: 'The Earth is flat.' },
      output: {
        state: 'complete',
        query: 'The Earth is flat.',
        claims: [
          {
            text: 'The Earth is flat.',
            claimReview: [
              {
                publisher: { name: 'Science Check' },
                url: 'https://sciencecheck.org/flat-earth',
                textualRating: 'False'
              }
            ]
          }
        ]
      }
    })
  })

  it('persists direct tool parts without dedicated columns as dynamic-backed tool parts', () => {
    const [mappedPart] = mapUIMessagePartsToDBParts(
      [
        {
          type: 'tool-wolframAlpha',
          toolCallId: 'call_wolfram',
          state: 'output-available',
          input: { query: 'sidereal orbital period of Mars in days' },
          output: { answer: '686.97959 days' }
        }
      ] as any[],
      'message_1'
    )

    expect(mappedPart).toMatchObject({
      messageId: 'message_1',
      order: 0,
      type: 'tool-wolframAlpha',
      tool_toolCallId: 'call_wolfram',
      tool_state: 'output-available',
      tool_dynamic_name: 'wolframAlpha',
      tool_dynamic_type: 'tool',
      tool_dynamic_input: {
        query: 'sidereal orbital period of Mars in days'
      },
      tool_dynamic_output: { answer: '686.97959 days' }
    })
  })

  it('round-trips direct dynamic-backed tool parts to their original UI shape', () => {
    const uiPart = mapDBPartToUIMessagePart({
      id: 'part_1',
      messageId: 'message_1',
      order: 0,
      type: 'tool-wolframAlpha',
      tool_toolCallId: 'call_wolfram',
      tool_state: 'output-error',
      tool_errorText: 'Wolfram|Alpha did not understand the query.',
      tool_dynamic_name: 'wolframAlpha',
      tool_dynamic_type: 'tool',
      tool_dynamic_input: { query: 'orbital period of Mars' },
      tool_dynamic_output: null,
      createdAt: new Date()
    } as any)

    expect(uiPart).toEqual({
      type: 'tool-wolframAlpha',
      state: 'output-error',
      toolCallId: 'call_wolfram',
      input: { query: 'orbital period of Mars' },
      errorText: 'Wolfram|Alpha did not understand the query.'
    })
  })

  it('preserves research subtask agent trace metadata across persistence', () => {
    const [mappedPart] = mapUIMessagePartsToDBParts(
      [
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
        }
      ] as any[],
      'message_1'
    )

    expect(mappedPart).toMatchObject({
      type: 'tool-researchSubtask',
      tool_toolCallId: 'call_subtask',
      tool_state: 'output-available',
      tool_dynamic_name: 'researchSubtask',
      tool_dynamic_type: 'tool',
      tool_dynamic_input: {
        task: 'Analyze evidence graph patterns',
        agentRole: 'verification-analyst'
      },
      tool_dynamic_output: {
        agentId: 'subagent_abc123',
        model: 'google:gemini-2.5-flash',
        parentModel: 'openai:gpt-5-mini',
        routing: 'role-route'
      }
    })

    expect(mapDBPartToUIMessagePart(mappedPart as any)).toEqual({
      type: 'tool-researchSubtask',
      state: 'output-available',
      toolCallId: 'call_subtask',
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
    })
  })
})
