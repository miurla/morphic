// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { TutorError } from '../errors'
import { generateTutorObject } from '../generation'

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  outputObject: vi.fn((options: unknown) => ({ type: 'object', options }))
}))
vi.mock('ai', () => ({
  generateText: mocks.generateText,
  Output: { object: mocks.outputObject }
}))
vi.mock('@/lib/utils/registry', () => ({
  getModel: () => ({ provider: 'compatible', modelId: 'teaching-model' })
}))
vi.mock('@/lib/utils/telemetry', () => ({ isTracingEnabled: () => false }))
vi.mock('../config', () => ({
  getTutorModelId: () => 'compatible:teaching-model'
}))

const schema = z.object({
  title: z.string().min(1),
  items: z
    .array(
      z.object({ sourceId: z.string(), score: z.number().min(0).max(100) })
    )
    .min(1)
})
const valid = {
  title: 'A grounded lesson',
  items: [{ sourceId: 'source-a', score: 80 }]
}
const options = {
  schema,
  task: 'lesson',
  locale: 'en',
  prompt: 'Create a lesson using the supplied sources.',
  data: { source: 'Private document text' }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('portable Tutor structured generation', () => {
  it('includes the complete trusted schema in instructions while retaining SDK structured output', async () => {
    mocks.generateText.mockResolvedValueOnce({ output: valid })
    expect(await generateTutorObject({ ...options, locale: 'zh-CN' })).toEqual(
      valid
    )
    const call = mocks.generateText.mock.calls[0][0]
    const jsonSchema = JSON.parse(
      call.instructions
        .split('<output_schema>\n')[1]
        .split('\n</output_schema>')[0]
    )
    expect(jsonSchema).toEqual(z.toJSONSchema(schema, { target: 'draft-07' }))
    expect(jsonSchema.required).toEqual(['title', 'items'])
    expect(jsonSchema.properties.items.items.properties.score.maximum).toBe(100)
    expect(call.instructions).toContain('Language: Simplified Chinese')
    expect(call.instructions).not.toContain('Private document text')
    expect(call.prompt).toBe(JSON.stringify(options.data))
    expect(mocks.outputObject).toHaveBeenCalledWith({ schema })
    expect(call).not.toHaveProperty('providerOptions')
  })

  it('repairs invalid output once and reuses the original request deadline', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const validate = vi.fn()
    mocks.generateText
      .mockResolvedValueOnce({ output: { title: 'Missing items' } })
      .mockResolvedValueOnce({ output: valid })
    expect(await generateTutorObject({ ...options, validate })).toEqual(valid)
    expect(mocks.generateText).toHaveBeenCalledTimes(2)
    expect(validate).toHaveBeenCalledExactlyOnceWith(valid)
    const [first, second] = mocks.generateText.mock.calls.map(([call]) => call)
    expect(second.abortSignal).toBe(first.abortSignal)
    expect(timeout).toHaveBeenCalledExactlyOnceWith(180_000)
    expect(second.instructions).toContain(
      'The previous result failed validation'
    )
    expect(second.instructions).toContain('<output_schema>')
  })

  it('applies domain validation after schema parsing and repairs foreign source IDs', async () => {
    mocks.generateText
      .mockResolvedValueOnce({
        output: { ...valid, items: [{ sourceId: 'foreign-source', score: 80 }] }
      })
      .mockResolvedValueOnce({ output: valid })
    const validate = vi.fn((value: z.infer<typeof schema>) => {
      if (value.items.some(item => item.sourceId !== 'source-a'))
        throw new Error('Unknown source')
    })
    expect(await generateTutorObject({ ...options, validate })).toEqual(valid)
    expect(validate).toHaveBeenCalledTimes(2)
    expect(mocks.generateText).toHaveBeenCalledTimes(2)
  })

  it('fails safely after two invalid results instead of accepting malformed data', async () => {
    mocks.generateText.mockResolvedValue({ output: { title: 4 } })
    await expect(generateTutorObject(options)).rejects.toMatchObject({
      code: 'GENERATION_FAILED',
      status: 502
    })
    expect(mocks.generateText).toHaveBeenCalledTimes(2)
  })

  it('uses one 90-second deadline across both grading attempts', async () => {
    const controller = new AbortController()
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(controller.signal)
    mocks.generateText
      .mockRejectedValueOnce(new Error('Transient failure'))
      .mockImplementationOnce(async () => {
        controller.abort()
        throw new Error('Provider details must stay private')
      })
    await expect(
      generateTutorObject({ ...options, task: 'grade' })
    ).rejects.toMatchObject({ code: 'GENERATION_TIMEOUT', status: 504 })
    expect(timeout).toHaveBeenCalledExactlyOnceWith(90_000)
    expect(mocks.generateText).toHaveBeenCalledTimes(2)
    for (const [call] of mocks.generateText.mock.calls)
      expect(call.abortSignal).toBe(controller.signal)
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
      'Provider details'
    )
  })

  it('does not retry explicit insufficient-evidence failures', async () => {
    mocks.generateText.mockResolvedValueOnce({ output: valid })
    await expect(
      generateTutorObject({
        ...options,
        validate: () => {
          throw new TutorError(
            'Evidence is insufficient.',
            'INSUFFICIENT_EVIDENCE',
            422
          )
        }
      })
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_EVIDENCE' })
    expect(mocks.generateText).toHaveBeenCalledTimes(1)
  })
})
