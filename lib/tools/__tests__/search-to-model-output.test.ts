import { describe, expect, it } from 'vitest'

import {
  createSearchTool,
  SEARCH_MODEL_CONTENT_MAX_CHARACTERS
} from '@/lib/tools/search'

// The search tool's toModelOutput strips UI-only fields (citationMap
// duplicates results; state is a streaming marker) from what the model sees.
// images MUST reach the model. getImageSpecPrompt instructs it to embed URLs
// verbatim from that array. All fields must survive in the streamed/persisted
// output for the UI.
describe('search tool toModelOutput', () => {
  const tool = createSearchTool('google:gemini-3-flash-preview')

  const fullOutput = {
    state: 'complete',
    query: 'test query',
    number_of_results: 2,
    results: [
      { title: 'A', url: 'https://a.test', content: 'alpha', label: 'S1' },
      { title: 'B', url: 'https://b.test', content: 'beta', label: 'S2' }
    ],
    images: [{ url: 'https://a.test/1.png', description: 'one' }],
    citationMap: {
      1: { title: 'A', url: 'https://a.test', content: 'alpha' },
      2: { title: 'B', url: 'https://b.test', content: 'beta' }
    },
    toolCallId: 'call_123',
    provider: 'tavily',
    fallback: {
      from: 'brave',
      to: 'tavily',
      reason: { type: 'http', status: 429 }
    }
  }

  const getModelValue = async (output: unknown) => {
    const modelOutput = await tool.toModelOutput?.({
      toolCallId: 'call_123',
      input: {} as never,
      output: output as never
    })
    expect(modelOutput?.type).toBe('json')
    return (modelOutput as { type: 'json'; value: Record<string, unknown> })
      .value
  }

  it('omits citationMap and state from the model output', async () => {
    const value = await getModelValue(fullOutput)

    expect(value).not.toHaveProperty('citationMap')
    expect(value).not.toHaveProperty('state')
  })

  it('keeps trace metadata out of the model output', async () => {
    const value = await getModelValue(fullOutput)

    expect(value).not.toHaveProperty('provider')
    expect(value).not.toHaveProperty('fallback')
  })

  it('preserves labelled results and omits the opaque tool call id', async () => {
    const value = await getModelValue(fullOutput)

    expect(value.results).toEqual(fullOutput.results)
    expect(value.query).toBe('test query')
    expect(value.number_of_results).toBe(2)
    expect(value).not.toHaveProperty('toolCallId')
  })

  it('truncates long result content and appends a marker', async () => {
    const content = 'a'.repeat(SEARCH_MODEL_CONTENT_MAX_CHARACTERS + 10)
    const value = await getModelValue({
      ...fullOutput,
      results: [{ ...fullOutput.results[0], content }]
    })
    const projectedContent = (value.results as Array<{ content: string }>)[0]
      .content

    expect(projectedContent).toBe(
      `${content.slice(0, SEARCH_MODEL_CONTENT_MAX_CHARACTERS)}…`
    )
    expect(projectedContent).toHaveLength(
      SEARCH_MODEL_CONTENT_MAX_CHARACTERS + 1
    )
  })

  it('preserves result content at or under the limit exactly', async () => {
    const contents = [
      'a'.repeat(SEARCH_MODEL_CONTENT_MAX_CHARACTERS),
      'short content'
    ]
    const value = await getModelValue({
      ...fullOutput,
      results: fullOutput.results.map((result, index) => ({
        ...result,
        content: contents[index]
      }))
    })

    expect(
      (value.results as Array<{ content: string }>).map(
        result => result.content
      )
    ).toEqual(contents)
  })

  // Providers do not all order by relevance: the firecrawl adapter appends news
  // results after web results, so dropping a tail would silently remove a whole
  // category from the model's view.
  it('keeps every result, in order, however many the provider returned', async () => {
    const results = Array.from({ length: 24 }, (_, index) => ({
      title: `Result ${index + 1}`,
      url: `https://${index + 1}.test`,
      content: `content ${index + 1}`,
      label: `S${index + 1}`
    }))
    const value = await getModelValue({ ...fullOutput, results })
    const projectedResults = value.results as typeof results

    expect(projectedResults).toHaveLength(results.length)
    expect(projectedResults.map(result => result.label)).toEqual(
      results.map(result => result.label)
    )
  })

  it('keeps the complete images array so the model can embed inline image specs', async () => {
    const images = Array.from({ length: 11 }, (_, index) => ({
      url: `https://images.test/${index}.png`,
      description: `image ${index}`
    }))
    const value = await getModelValue({ ...fullOutput, images })

    expect(value.images).toBe(images)
    expect(value.images).toHaveLength(images.length)
  })

  it('passes through non-string and missing result content', async () => {
    const results = [
      {
        title: 'Number',
        url: 'https://number.test',
        content: 123,
        label: 'S1'
      },
      { title: 'Missing', url: 'https://missing.test', label: 'S2' }
    ]
    const value = await getModelValue({ ...fullOutput, results })

    expect(value.results).toEqual(results)
  })

  it('passes through a non-array results value', async () => {
    const results = { malformed: true }
    const value = await getModelValue({ ...fullOutput, results })

    expect(value.results).toBe(results)
  })

  it('does not mutate the original output (UI/persistence keep all fields)', async () => {
    await tool.toModelOutput?.({
      toolCallId: 'call_123',
      input: {} as never,
      output: fullOutput as never
    })

    expect(fullOutput).toHaveProperty('citationMap')
    expect(fullOutput).toHaveProperty('state')
    expect(fullOutput).toHaveProperty('provider')
    expect(fullOutput).toHaveProperty('fallback')
    expect(fullOutput.results.map(result => result.label)).toEqual(['S1', 'S2'])
  })

  it('does not truncate content on the original output object', async () => {
    const content = 'a'.repeat(SEARCH_MODEL_CONTENT_MAX_CHARACTERS + 10)
    const output = {
      ...fullOutput,
      results: [{ ...fullOutput.results[0], content }]
    }

    await getModelValue(output)

    expect(output.results[0].content).toBe(content)
    expect(output.results[0].content).toHaveLength(content.length)
  })

  it('returns identical persisted labels across repeated conversion', async () => {
    const first = await getModelValue(fullOutput)
    const second = await getModelValue(fullOutput)

    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    expect(second.results).toEqual(fullOutput.results)
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
