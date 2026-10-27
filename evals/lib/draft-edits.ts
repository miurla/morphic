import type { UIMessage } from 'ai'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

import { parseDraftBlocks } from '@/lib/draft/draft'

import datasetJson from '../datasets/draft-edits.json'

import type { SearchFixture } from './dataset'

export type DraftEditsMode = 'quick' | 'adaptive'

export type DraftEditsCategory = 'unrelated' | 'new' | 'edit'

export type DraftEditsInput = {
  mode: DraftEditsMode
  /** The chat so far, ending with the user turn under test. */
  messages: UIMessage[]
  results: SearchFixture[]
}

export type DraftEditsExpected = {
  category: DraftEditsCategory
}

export type DraftEditsMetadata = {
  itemId: string
  category: DraftEditsCategory
  source: 'synthetic' | 'production'
  trial: number
}

export type DraftEditsItem = {
  input: DraftEditsInput
  expectedOutput: DraftEditsExpected
  metadata: DraftEditsMetadata
}

type RawChat = {
  mode: string
  messages: { role: string; text: string }[]
}

type RawItem = {
  id: string
  chat: string
  category: string
  query: string
}

type SeedItem = {
  id: string
  category: string
  mode: string
  messages: UIMessage[]
  results: SearchFixture[]
}

/**
 * Production turns, built from the chats where the hijack was observed. They
 * hold users' own text, so they live in a gitignored file and are used only
 * when it exists.
 */
export const LOCAL_SEEDS_PATH = path.join(
  __dirname,
  '..',
  '_local',
  'draft-edits-seeds.json'
)

export function isDraftEditsCategory(
  value: unknown
): value is DraftEditsCategory {
  return value === 'unrelated' || value === 'new' || value === 'edit'
}

function isMode(value: unknown): value is DraftEditsMode {
  return value === 'quick' || value === 'adaptive'
}

function textMessage(id: string, role: string, text: string): UIMessage {
  return {
    id,
    role: role as UIMessage['role'],
    parts: [{ type: 'text', text }]
  }
}

type SourceItem = Omit<DraftEditsItem, 'metadata'> & { id: string }

function syntheticItems(): SourceItem[] {
  const chats = datasetJson.chats as Record<string, RawChat>
  return (datasetJson.items as RawItem[]).map(raw => {
    const chat = chats[raw.chat]
    if (!chat) {
      throw new Error(`Item "${raw.id}" references unknown chat "${raw.chat}"`)
    }
    if (!isDraftEditsCategory(raw.category) || !isMode(chat.mode)) {
      throw new Error(`Item "${raw.id}" has an unknown category or mode`)
    }
    const messages = [
      ...chat.messages.map((message, index) =>
        textMessage(`${raw.chat}-${index}`, message.role, message.text)
      ),
      textMessage(`${raw.id}-query`, 'user', raw.query)
    ]
    return {
      id: raw.id,
      input: { mode: chat.mode, messages, results: [] },
      expectedOutput: { category: raw.category }
    }
  })
}

function productionItems(seedsPath: string): SourceItem[] {
  if (!existsSync(seedsPath)) return []
  const seeds = JSON.parse(readFileSync(seedsPath, 'utf8')) as {
    items: SeedItem[]
  }
  return seeds.items.map(seed => {
    if (!isDraftEditsCategory(seed.category) || !isMode(seed.mode)) {
      throw new Error(`Seed "${seed.id}" has an unknown category or mode`)
    }
    return {
      id: seed.id,
      input: {
        mode: seed.mode,
        messages: seed.messages,
        results: seed.results
      },
      expectedOutput: { category: seed.category }
    }
  })
}

export function loadDraftEditsDataset({
  trials = 1,
  ids,
  seedsPath = LOCAL_SEEDS_PATH,
  includeSynthetic = true
}: {
  trials?: number
  ids?: string[]
  seedsPath?: string
  includeSynthetic?: boolean
} = {}): DraftEditsItem[] {
  const wanted = ids && ids.length > 0 ? new Set(ids) : null
  const sources = [
    ...(includeSynthetic
      ? syntheticItems().map(item => ({
          ...item,
          source: 'synthetic' as const
        }))
      : []),
    ...productionItems(seedsPath).map(item => ({
      ...item,
      source: 'production' as const
    }))
  ]

  const items: DraftEditsItem[] = []
  for (const { id, input, expectedOutput, source } of sources) {
    if (wanted && !wanted.has(id)) continue
    for (let trial = 1; trial <= trials; trial++) {
      items.push({
        input,
        expectedOutput,
        metadata: {
          itemId: id,
          category: expectedOutput.category,
          source,
          trial
        }
      })
    }
  }

  if (wanted) {
    const found = new Set(items.map(item => item.metadata.itemId))
    const missing = [...wanted].filter(id => !found.has(id))
    if (missing.length > 0) {
      throw new Error(`Unknown item id(s): ${missing.join(', ')}`)
    }
  }

  return items
}

export const draftEditsDatasetDescription = datasetJson.description

export type DraftEditCall = {
  input: unknown
  /** How many changes the tool applied; 0 when it rejected every edit. */
  applied: number
}

export type DraftTurnOutput = {
  text: string
  editCalls: DraftEditCall[]
}

export type DraftTurnAnalysis = {
  /** editDraft was called at all, whether or not it applied anything. */
  calledEdit: boolean
  /** editDraft changed the draft. */
  changedDraft: boolean
  /** The answer holds a completed draft block with content. */
  wroteBlock: boolean
  /** The turn did what its category asks for. */
  correct: boolean
}

export function analyzeDraftTurn(
  output: DraftTurnOutput,
  category: DraftEditsCategory
): DraftTurnAnalysis {
  const calledEdit = output.editCalls.length > 0
  const changedDraft = output.editCalls.some(call => call.applied > 0)
  const wroteBlock = parseDraftBlocks(output.text).some(
    block => block.closed && block.content.trim().length > 0
  )

  const correct =
    category === 'unrelated'
      ? !calledEdit
      : category === 'new'
        ? wroteBlock && !calledEdit
        : changedDraft || wroteBlock

  return { calledEdit, changedDraft, wroteBlock, correct }
}
