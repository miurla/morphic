import type { UIMessage } from 'ai'

import { estimateAttachmentTokens } from '@/lib/utils/attachment-tokens'
import { countTextTokens } from '@/lib/utils/context-window'

import { compactHistoricalMessages } from './compact-historical-messages'

const DEFAULT_COLD_START_HISTORY_TOKEN_LIMIT = 200_000
const CACHE_IDLE_MS = 30 * 60 * 1000
const MIN_TURNS = 5
const MESSAGE_TOKEN_OVERHEAD = 4

export function parseColdStartHistoryTokenLimit(
  raw: string | undefined
): number {
  const value = raw?.trim()
  if (!value) return DEFAULT_COLD_START_HISTORY_TOKEN_LIMIT

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_COLD_START_HISTORY_TOKEN_LIMIT
  }

  return parsed === 0 ? 0 : Math.max(1, Math.floor(parsed))
}

export const COLD_START_HISTORY_TOKEN_LIMIT = parseColdStartHistoryTokenLimit(
  process.env.COLD_START_HISTORY_TOKEN_LIMIT
)

type ReplayedText = {
  text: string
  fixedTokens: number
}

type Turn = {
  messages: UIMessage[]
  timestamp?: number
  replayed: ReplayedText[]
}

const textEncoder = new TextEncoder()

function serialize(value: unknown): string {
  if (value === undefined) return ''

  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}

function describeReplayedMessage(message: UIMessage): ReplayedText {
  const texts: string[] = []
  let attachmentTokens = 0

  for (const part of message.parts) {
    if (part.type === 'text' || part.type === 'reasoning') {
      texts.push(part.text)
    } else if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
      const toolPart = part as { input?: unknown; output?: unknown }
      texts.push(serialize(toolPart.input), serialize(toolPart.output))
    } else if (part.type.startsWith('data-')) {
      texts.push(serialize((part as { data?: unknown }).data))
    } else if (part.type === 'file') {
      const filePart = part as { mediaType?: string; size?: number }
      attachmentTokens += estimateAttachmentTokens(filePart)
    }
  }

  return {
    text: texts.join(''),
    fixedTokens: MESSAGE_TOKEN_OVERHEAD + attachmentTokens
  }
}

// Described on the message's historical replay form, which depends only on
// the message itself, so the estimate does not change as the thread grows.
function describeMessage(message: UIMessage): ReplayedText[] {
  return compactHistoricalMessages([message]).map(describeReplayedMessage)
}

// A token always spans at least one UTF-8 byte, so this bounds any tokenizer
// without running one.
function tokenUpperBound(turn: Turn): number {
  return turn.replayed.reduce(
    (total, { text, fixedTokens }) =>
      total + textEncoder.encode(text).length + fixedTokens,
    0
  )
}

function countTurnTokens(turn: Turn, modelId?: string): number {
  return turn.replayed.reduce(
    (total, { text, fixedTokens }) =>
      total + countTextTokens(text, modelId) + fixedTokens,
    0
  )
}

function parseTimestamp(value: unknown): number | undefined {
  if (!(value instanceof Date) && typeof value !== 'string') return undefined

  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function getCreatedAt(message: UIMessage): unknown {
  const metadata = message.metadata
  if (!metadata || typeof metadata !== 'object') return undefined

  return (metadata as { createdAt?: unknown }).createdAt
}

function buildTurns(messages: UIMessage[], now: Date): Turn[] {
  const userIndexes = messages.flatMap((message, index) =>
    message.role === 'user' ? [index] : []
  )
  if (userIndexes.length === 0) return []

  return userIndexes.map((userIndex, turnIndex) => {
    const start = turnIndex === 0 ? 0 : userIndex
    const end = userIndexes[turnIndex + 1] ?? messages.length
    const turnMessages = messages.slice(start, end)
    const timestamp =
      parseTimestamp(getCreatedAt(messages[userIndex])) ??
      (turnIndex === userIndexes.length - 1 ? now.getTime() : undefined)

    return {
      messages: turnMessages,
      timestamp,
      replayed: turnMessages.flatMap(describeMessage)
    }
  })
}

export function trimColdStartHistory(
  messages: UIMessage[],
  options: { now?: Date; limit?: number; modelId?: string } = {}
): { messages: UIMessage[]; trimmedAtCurrentTurn: boolean } {
  const limit = options.limit ?? COLD_START_HISTORY_TOKEN_LIMIT
  if (limit <= 0) return { messages, trimmedAtCurrentTurn: false }

  const turns = buildTurns(messages, options.now ?? new Date())
  if (turns.length < MIN_TURNS) {
    return { messages, trimmedAtCurrentTurn: false }
  }

  const upperBound = turns.reduce(
    (total, turn) => total + tokenUpperBound(turn),
    0
  )
  if (upperBound <= limit) return { messages, trimmedAtCurrentTurn: false }

  const tokens = turns.map(turn => countTurnTokens(turn, options.modelId))
  let cut = 1
  let trimmedAtCurrentTurn = false

  for (let i = 1; i < turns.length; i++) {
    const previousTimestamp = turns[i - 1].timestamp
    const timestamp = turns[i].timestamp
    const cold =
      previousTimestamp !== undefined &&
      timestamp !== undefined &&
      timestamp - previousTimestamp > CACHE_IDLE_MS

    if (!cold || i + 1 < MIN_TURNS) continue

    let total = tokens[0]
    for (let j = cut; j <= i; j++) total += tokens[j]

    const cutBefore = cut
    while (total > limit && cut < i) {
      total -= tokens[cut]
      cut += 1
    }

    if (i === turns.length - 1 && cut > cutBefore) {
      trimmedAtCurrentTurn = true
    }
  }

  if (cut === 1) return { messages, trimmedAtCurrentTurn: false }

  return {
    messages: [turns[0], ...turns.slice(cut)].flatMap(turn => turn.messages),
    trimmedAtCurrentTurn
  }
}
