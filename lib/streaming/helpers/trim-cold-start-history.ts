import type { UIMessage } from 'ai'

import { estimateAttachmentTokens } from '@/lib/utils/attachment-tokens'

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

type Turn = {
  messages: UIMessage[]
  timestamp?: number
  tokens: number
}

function serializedLength(value: unknown): number {
  if (value === undefined) return 0

  try {
    return JSON.stringify(value)?.length ?? 0
  } catch {
    return 0
  }
}

function estimateMessageTokens(message: UIMessage): number {
  let chars = 0
  let attachmentTokens = 0

  for (const part of message.parts) {
    if (part.type === 'text' || part.type === 'reasoning') {
      chars += part.text.length
    } else if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
      const toolPart = part as { input?: unknown; output?: unknown }
      chars += serializedLength(toolPart.input)
      chars += serializedLength(toolPart.output)
    } else if (part.type.startsWith('data-')) {
      chars += serializedLength((part as { data?: unknown }).data)
    } else if (part.type === 'file') {
      const filePart = part as { mediaType?: string; size?: number }
      attachmentTokens += estimateAttachmentTokens(filePart)
    }
  }

  return Math.ceil(chars / 4) + MESSAGE_TOKEN_OVERHEAD + attachmentTokens
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
      tokens: turnMessages.reduce(
        (total, message) => total + estimateMessageTokens(message),
        0
      )
    }
  })
}

export function trimColdStartHistory(
  messages: UIMessage[],
  options: { now?: Date; limit?: number } = {}
): { messages: UIMessage[]; trimmedAtCurrentTurn: boolean } {
  const limit = options.limit ?? COLD_START_HISTORY_TOKEN_LIMIT
  if (limit <= 0) return { messages, trimmedAtCurrentTurn: false }

  const turns = buildTurns(messages, options.now ?? new Date())
  if (turns.length < MIN_TURNS) {
    return { messages, trimmedAtCurrentTurn: false }
  }

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

    let total = turns[0].tokens
    for (let j = cut; j <= i; j++) total += turns[j].tokens

    const cutBefore = cut
    while (total > limit && cut < i) {
      total -= turns[cut].tokens
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
