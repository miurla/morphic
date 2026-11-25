import { createHash } from 'node:crypto'
import { z } from 'zod'

import { countTokens } from './chunking'
import { TutorError } from './errors'
import { generateTutorObject } from './generation'

export interface PlanningNote {
  id: string
  title: string
  summary: string
  sourceIds: string[]
}

export const PLANNING_COMPACTION_VERSION = 'tutor-planning-compaction-v1'
export const PLANNING_TOKEN_BUDGET = 16_000
export const PLANNING_TOPIC_LIMIT = 80
export const COMPACTION_BATCH_TOKEN_BUDGET = 6500
export const MAX_COMPACTION_LAYERS = 3

const compactTopicsSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z.string().min(1).max(180),
        summary: z.string().min(1).max(600),
        unitIds: z.array(z.string()).min(1)
      })
    )
    .min(1)
    .max(6)
})

const planningNoteSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(180),
  summary: z.string().min(1).max(600),
  sourceIds: z.array(z.string().min(1)).min(1)
})

function promptUnits(notes: PlanningNote[]) {
  return notes.map(({ id, title, summary }) => ({ id, title, summary }))
}

/** The course planner receives these fields, never the potentially large list
 * of raw evidence IDs, which remains available in server-side notes. */
export function planningPayloadTokens(notes: PlanningNote[]): number {
  return countTokens(JSON.stringify(promptUnits(notes)))
}

function fitsPlan(notes: PlanningNote[]): boolean {
  return (
    notes.length <= PLANNING_TOPIC_LIMIT &&
    planningPayloadTokens(notes) <= PLANNING_TOKEN_BUDGET
  )
}

function planningLimit(): TutorError {
  return new TutorError(
    'This material is too large to organize reliably in one course. Split the documents into smaller learning courses and try again.',
    'PLANNING_LIMIT',
    422
  )
}

function batchesFor(notes: PlanningNote[]): PlanningNote[][] {
  const batches: PlanningNote[][] = []
  // Estimate each unit once instead of re-encoding the whole growing batch.
  // JSON separators can change boundary token merges; the exact check below
  // remains authoritative and splits an oversized group without dropping it.
  const envelopeTokens = countTokens('{"units":[]}') + 8
  let batch: PlanningNote[] = []
  let estimatedTokens = envelopeTokens
  const appendChecked = (group: PlanningNote[]): void => {
    if (
      countTokens(JSON.stringify({ units: promptUnits(group) })) <=
      COMPACTION_BATCH_TOKEN_BUDGET
    ) {
      batches.push(group)
      return
    }
    if (group.length === 1) throw planningLimit()
    const middle = Math.ceil(group.length / 2)
    appendChecked(group.slice(0, middle))
    appendChecked(group.slice(middle))
  }
  for (const note of notes) {
    const size = countTokens(JSON.stringify(promptUnits([note])[0])) + 2
    if (
      batch.length &&
      estimatedTokens + size > COMPACTION_BATCH_TOKEN_BUDGET
    ) {
      appendChecked(batch)
      batch = []
      estimatedTokens = envelopeTokens
    }
    batch.push(note)
    estimatedTokens += size
  }
  if (batch.length) appendChecked(batch)
  return batches
}

function sameSources(left: PlanningNote[], right: PlanningNote[]): boolean {
  const expected = new Set(left.flatMap(note => note.sourceIds))
  const actual = new Set(right.flatMap(note => note.sourceIds))
  return (
    expected.size === actual.size && [...actual].every(id => expected.has(id))
  )
}

function validCheckpoint(
  value: PlanningNote[] | undefined,
  input: PlanningNote[],
  key: string
): value is PlanningNote[] {
  if (!value || !value.length || value.length > 6) return false
  if (
    value.some(
      (note, index) =>
        !planningNoteSchema.safeParse(note).success ||
        note.id !== `${key}-${index}`
    )
  )
    return false
  return sameSources(input, value)
}

/** Compress only the planning index. Every input note must be covered, and all
 * original evidence IDs survive so lessons still retrieve and cite source text. */
export async function compactPlanningNotes({
  notes,
  locale,
  checkpoint,
  saveCheckpoint,
  ensureActive
}: {
  notes: PlanningNote[]
  locale: string
  checkpoint: Record<string, PlanningNote[]>
  saveCheckpoint: (map: Record<string, PlanningNote[]>) => Promise<void>
  ensureActive?: () => Promise<void>
}): Promise<PlanningNote[]> {
  await ensureActive?.()
  if (
    new Set(notes.map(note => note.id)).size !== notes.length ||
    notes.some(
      note => !note.id || !note.title || !note.summary || !note.sourceIds.length
    )
  ) {
    throw new TutorError(
      'The learning topic index is invalid. Please retry creating the course.',
      'INVALID_PLANNING_NOTES',
      422
    )
  }
  if (fitsPlan(notes)) return notes
  let current = notes
  for (let layer = 0; layer < MAX_COMPACTION_LAYERS; layer++) {
    const next: PlanningNote[] = []
    for (const batch of batchesFor(current)) {
      await ensureActive?.()
      // Contents and provenance are included as well as IDs: reusing an ID
      // after a model/prompt change must not reuse a different summary.
      const digest = createHash('sha256')
        .update(
          JSON.stringify({
            version: PLANNING_COMPACTION_VERSION,
            locale,
            layer,
            notes: batch
          })
        )
        .digest('hex')
      const key = `compact-${digest.slice(0, 32)}`
      if (!validCheckpoint(checkpoint[key], batch, key)) {
        const inputIds = new Set(batch.map(note => note.id))
        const output = await generateTutorObject({
          schema: compactTopicsSchema,
          ensureActive,
          task: 'compact-plan',
          locale,
          prompt:
            'Merge related planning notes into at most SIX concise teachable topics. Keep important qualifications, prerequisites, and distinct concepts in the summaries. Every input unit id must occur in unitIds at least once. Use only supplied ids. Each summary is at most 600 characters. Do not invent facts or remove a topic merely because it is less common. These summaries are a planning index; teaching and citations will still use the original sources.',
          data: { units: promptUnits(batch) },
          validate: value => {
            const covered = new Set(
              value.topics.flatMap(topic => topic.unitIds)
            )
            if (
              covered.size !== inputIds.size ||
              [...covered].some(id => !inputIds.has(id))
            ) {
              throw new Error(
                'The compacted planning index has missing or unknown input IDs.'
              )
            }
          }
        })
        await ensureActive?.()
        const byId = new Map(batch.map(note => [note.id, note]))
        const compacted: PlanningNote[] = output.topics.map((topic, index) => ({
          id: `${key}-${index}`,
          title: topic.title,
          summary: topic.summary,
          sourceIds: [
            ...new Set(topic.unitIds.flatMap(id => byId.get(id)!.sourceIds))
          ]
        }))
        if (!sameSources(batch, compacted))
          throw new Error('Planning compaction lost source references.')
        // Save the whole map (including extraction checkpoints). Only publish
        // the new in-memory entry after persistence succeeds.
        const updated = { ...checkpoint, [key]: compacted }
        await saveCheckpoint(updated)
        checkpoint[key] = compacted
      }
      next.push(...checkpoint[key])
    }
    current = next
    if (fitsPlan(current)) {
      if (!sameSources(notes, current))
        throw new Error('Planning compaction lost source references.')
      return current
    }
  }
  throw planningLimit()
}
