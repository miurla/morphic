import { describe, expect, it } from 'vitest'

import { createSearchTool } from '@/lib/tools/search'

// The search tool's toModelOutput strips UI-only fields (citationMap duplicates
// results; images are display thumbnails) from what the model sees, halving the
// search payload's token weight. These fields must survive in the streamed/
// persisted output (for the UI) but never reach the model.
describe('search tool toModelOutput', () => {
  const tool = createSearchTool('google:gemini-3-flash-preview')

  const fullOutput = {
    state: 'complete',
    query: 'test query',
    number_of_results: 2,
    results: [
      { title: 'A', url: 'https://a.test', content: 'alpha' },
      { title: 'B', url: 'https://b.test', content: 'beta' }
    ],
    images: [{ url: 'https://a.test/1.png' }],
    citationMap: {
      1: { title: 'A', url: 'https://a.test', content: 'alpha' },
      2: { title: 'B', url: 'https://b.test', content: 'beta' }
    },
    toolCallId: 'call_123'
  }

  it('omits citationMap, images, and state from the model output', async () => {
    const modelOutput = await tool.toModelOutput?.({
      toolCallId: 'call_123',
      input: {} as never,
      output: fullOutput as never
    })

    expect(modelOutput).toBeDefined()
    expect(modelOutput?.type).toBe('json')
    const value = (
      modelOutput as { type: 'json'; value: Record<string, unknown> }
    ).value

    expect(value).not.toHaveProperty('citationMap')
    expect(value).not.toHaveProperty('images')
    expect(value).not.toHaveProperty('state')
  })

  it('preserves the fields the model needs to answer and to cite', async () => {
    const modelOutput = await tool.toModelOutput?.({
      toolCallId: 'call_123',
      input: {} as never,
      output: fullOutput as never
    })
    const value = (
      modelOutput as { type: 'json'; value: Record<string, unknown> }
    ).value

    expect(value.results).toEqual(fullOutput.results)
    expect(value.query).toBe('test query')
    expect(value.number_of_results).toBe(2)
    // toolCallId is required: the prompt cites as [number](#toolCallId).
    expect(value.toolCallId).toBe('call_123')
  })

  it('does not mutate the original output (UI/persistence keep all fields)', async () => {
    await tool.toModelOutput?.({
      toolCallId: 'call_123',
      input: {} as never,
      output: fullOutput as never
    })

    expect(fullOutput).toHaveProperty('citationMap')
    expect(fullOutput).toHaveProperty('images')
  })

  it('handles non-object output defensively', async () => {
    const modelOutput = await tool.toModelOutput?.({
      toolCallId: 'call_123',
      input: {} as never,
      output: null as never
    })

    expect(modelOutput).toEqual({ type: 'json', value: null })
  })
})
