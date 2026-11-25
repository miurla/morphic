// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'

import { countTokens } from '../chunking'
import {
  COMPACTION_BATCH_TOKEN_BUDGET,
  compactPlanningNotes,
  PLANNING_TOKEN_BUDGET,
  PLANNING_TOPIC_LIMIT,
  type PlanningNote,
  planningPayloadTokens
} from '../planning'

const mocks = vi.hoisted(() => ({ generateTutorObject: vi.fn() }))
vi.mock('../generation', () => mocks)

type TopicOutput = {
  topics: { title: string; summary: string; unitIds: string[] }[]
}
type GenerationOptions = {
  schema: z.ZodType<TopicOutput>
  data: { units: Omit<PlanningNote, 'sourceIds'>[] }
  validate: (value: TopicOutput) => void
}

function notes(
  count: number,
  summary = 'Explain this topic and its practical use.'
): PlanningNote[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `topic-${index}`,
    title: `Topic ${index}`,
    summary,
    sourceIds: [`source-${index}`, 'shared-source']
  }))
}

function modelResult(
  options: GenerationOptions,
  topics: TopicOutput['topics']
) {
  const result = options.schema.parse({ topics })
  options.validate(result)
  return result
}

function mergeGroups(options: GenerationOptions) {
  const groups: string[][] = Array.from(
    { length: Math.min(options.data.units.length, 6) },
    () => []
  )
  options.data.units.forEach((unit, index) =>
    groups[index % groups.length].push(unit.id)
  )
  return modelResult(
    options,
    groups.map((unitIds, index) => ({
      title: `Merged topic ${index}`,
      summary: 'A concise planning summary covering the supplied units.',
      unitIds
    }))
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.generateTutorObject.mockImplementation(mergeGroups)
})

describe('bounded planning compaction', () => {
  it('keeps a small index unchanged without a model call or checkpoint write', async () => {
    const input = notes(8)
    const saveCheckpoint = vi.fn()
    const result = await compactPlanningNotes({
      notes: input,
      locale: 'en',
      checkpoint: {},
      saveCheckpoint
    })
    expect(result).toBe(input)
    expect(mocks.generateTutorObject).not.toHaveBeenCalled()
    expect(saveCheckpoint).not.toHaveBeenCalled()
  })

  it('merges excess topics while retaining every original source and existing checkpoint', async () => {
    const input = notes(81)
    const checkpoint = { extraction: notes(1) }
    const saveCheckpoint = vi.fn().mockResolvedValue(undefined)
    const result = await compactPlanningNotes({
      notes: input,
      locale: 'en',
      checkpoint,
      saveCheckpoint
    })
    expect(result).toHaveLength(6)
    expect(new Set(result.flatMap(note => note.sourceIds))).toEqual(
      new Set(input.flatMap(note => note.sourceIds))
    )
    expect(saveCheckpoint).toHaveBeenCalledTimes(1)
    expect(saveCheckpoint.mock.calls[0][0].extraction).toEqual(
      checkpoint.extraction
    )
    expect(
      mocks.generateTutorObject.mock.calls[0][0].data.units[0]
    ).not.toHaveProperty('sourceIds')
    expect(planningPayloadTokens(result)).toBeLessThanOrEqual(
      PLANNING_TOKEN_BUDGET
    )
  })

  it('splits long bilingual notes into token-bounded requests before planning', async () => {
    const input = notes(
      50,
      '数据库事务隔离，transaction atomicity。'.repeat(30)
    )
    expect(planningPayloadTokens(input)).toBeGreaterThan(PLANNING_TOKEN_BUDGET)
    const result = await compactPlanningNotes({
      notes: input,
      locale: 'zh-CN',
      checkpoint: {},
      saveCheckpoint: vi.fn()
    })
    expect(mocks.generateTutorObject.mock.calls.length).toBeGreaterThan(1)
    for (const [options] of mocks.generateTutorObject.mock.calls) {
      expect(countTokens(JSON.stringify(options.data))).toBeLessThanOrEqual(
        COMPACTION_BATCH_TOKEN_BUDGET
      )
    }
    expect(result.length).toBeLessThanOrEqual(PLANNING_TOPIC_LIMIT)
    expect(planningPayloadTokens(result)).toBeLessThanOrEqual(
      PLANNING_TOKEN_BUDGET
    )
    expect(new Set(result.flatMap(note => note.sourceIds))).toEqual(
      new Set(input.flatMap(note => note.sourceIds))
    )
  })

  it.each(['omitted', 'unknown'])(
    'rejects %s input IDs before saving a checkpoint',
    async mode => {
      mocks.generateTutorObject.mockImplementation(
        (options: GenerationOptions) => {
          const unitIds = options.data.units.map(unit => unit.id)
          if (mode === 'omitted') unitIds.pop()
          else unitIds.push('not-in-input')
          return modelResult(options, [
            { title: 'Topic', summary: 'Summary', unitIds }
          ])
        }
      )
      const saveCheckpoint = vi.fn()
      await expect(
        compactPlanningNotes({
          notes: notes(81),
          locale: 'en',
          checkpoint: {},
          saveCheckpoint
        })
      ).rejects.toThrow('missing or unknown')
      expect(saveCheckpoint).not.toHaveBeenCalled()
    }
  )

  it('reuses persisted summaries on retry and invalidates them when locale or inputs change', async () => {
    const input = notes(81)
    const checkpoint: Record<string, PlanningNote[]> = {}
    const saveCheckpoint = vi.fn().mockResolvedValue(undefined)
    const options = { notes: input, locale: 'en', checkpoint, saveCheckpoint }
    const initial = await compactPlanningNotes(options)
    expect(await compactPlanningNotes(options)).toEqual(initial)
    expect(mocks.generateTutorObject).toHaveBeenCalledTimes(1)
    expect(saveCheckpoint).toHaveBeenCalledTimes(1)
    await compactPlanningNotes({ ...options, locale: 'zh-CN' })
    expect(mocks.generateTutorObject).toHaveBeenCalledTimes(2)
    await compactPlanningNotes({
      ...options,
      notes: input.map((note, index) =>
        index ? note : { ...note, summary: 'Changed source summary.' }
      )
    })
    expect(mocks.generateTutorObject).toHaveBeenCalledTimes(3)
  })

  it('regenerates a checkpoint whose source list was lost or polluted', async () => {
    const input = notes(81)
    const checkpoint: Record<string, PlanningNote[]> = {}
    const options = {
      notes: input,
      locale: 'en',
      checkpoint,
      saveCheckpoint: vi.fn()
    }
    await compactPlanningNotes(options)
    const key = Object.keys(checkpoint)[0]
    checkpoint[key][0].sourceIds = ['foreign-source']
    const repaired = await compactPlanningNotes(options)
    expect(mocks.generateTutorObject).toHaveBeenCalledTimes(2)
    expect(new Set(repaired.flatMap(note => note.sourceIds))).toEqual(
      new Set(input.flatMap(note => note.sourceIds))
    )
  })

  it('does not publish a checkpoint until its write succeeds', async () => {
    const checkpoint: Record<string, PlanningNote[]> = {}
    const options = {
      notes: notes(81),
      locale: 'en',
      checkpoint,
      saveCheckpoint: vi
        .fn()
        .mockRejectedValueOnce(new Error('Storage unavailable'))
        .mockResolvedValue(undefined)
    }
    await expect(compactPlanningNotes(options)).rejects.toThrow(
      'Storage unavailable'
    )
    expect(checkpoint).toEqual({})
    await compactPlanningNotes(options)
    expect(mocks.generateTutorObject).toHaveBeenCalledTimes(2)
    expect(Object.keys(checkpoint)).toHaveLength(1)
  })

  it('stops after three unsuccessful layers with an actionable size error', async () => {
    const input = notes(36, '知识，'.repeat(200)).map(note => ({
      ...note,
      title: '标题，'.repeat(60)
    }))
    mocks.generateTutorObject.mockImplementation(
      (options: GenerationOptions) => {
        const groups: string[][] = Array.from(
          { length: Math.min(options.data.units.length, 6) },
          () => []
        )
        options.data.units.forEach((unit, index) =>
          groups[index % groups.length].push(unit.id)
        )
        return modelResult(
          options,
          groups.map(unitIds => ({
            title: '标题，'.repeat(60),
            summary: '知识，'.repeat(200),
            unitIds
          }))
        )
      }
    )
    const checkpoint: Record<string, PlanningNote[]> = {}
    await expect(
      compactPlanningNotes({
        notes: input,
        locale: 'zh-CN',
        checkpoint,
        saveCheckpoint: vi.fn()
      })
    ).rejects.toMatchObject({ code: 'PLANNING_LIMIT', status: 422 })
    // Every generated unit has one more compaction ancestor than its inputs.
    // A fourth layer must not be requested even when the model barely shrinks.
    const depth = new Map(input.map(note => [note.id, 0]))
    for (const compacted of Object.values(checkpoint)) {
      const call = mocks.generateTutorObject.mock.calls[
        Object.values(checkpoint).indexOf(compacted)
      ][0] as GenerationOptions
      const level =
        Math.max(...call.data.units.map(unit => depth.get(unit.id)!)) + 1
      compacted.forEach(note => depth.set(note.id, level))
    }
    expect(Math.max(...depth.values())).toBe(3)
  })
})
