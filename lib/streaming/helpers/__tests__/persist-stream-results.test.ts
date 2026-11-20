import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createChatWithFirstMessage, upsertMessage } from '@/lib/actions/chat'
import { updateChatTitle } from '@/lib/db/actions'

import { persistStreamResults } from '../persist-stream-results'

vi.mock('@/lib/actions/chat', () => ({
  createChatWithFirstMessage: vi.fn(),
  upsertMessage: vi.fn()
}))

vi.mock('@/lib/db/actions', () => ({
  updateChatTitle: vi.fn()
}))

const userMessage = {
  id: 'user-message',
  role: 'user' as const,
  parts: [{ type: 'text' as const, text: 'hello' }]
}

function responseMessage() {
  return {
    id: 'response',
    role: 'assistant' as const,
    parts: [{ type: 'text' as const, text: 'answer' }]
  }
}

function missingSpaceError() {
  return Object.assign(new Error('Failed query: insert into "chats"'), {
    cause: {
      message:
        'insert or update on table "chats" violates foreign key constraint "chats_space_id_spaces_id_fk"',
      constraint_name: 'chats_space_id_spaces_id_fk'
    }
  })
}

describe('persistStreamResults initial save fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(createChatWithFirstMessage).mockResolvedValue({} as any)
    vi.mocked(upsertMessage).mockResolvedValue({} as any)
  })

  it('saves the chat in the default space when its space was deleted', async () => {
    await persistStreamResults(
      responseMessage(),
      'chat-1',
      'user-1',
      undefined,
      undefined,
      undefined,
      undefined,
      Promise.reject(missingSpaceError()),
      userMessage,
      'space-1'
    )

    expect(createChatWithFirstMessage).toHaveBeenCalledWith(
      'chat-1',
      userMessage,
      'user-1',
      'Untitled',
      null
    )
    expect(upsertMessage).toHaveBeenCalled()
  })

  it('keeps the space when the initial save failed for another reason', async () => {
    await persistStreamResults(
      responseMessage(),
      'chat-1',
      'user-1',
      undefined,
      undefined,
      undefined,
      undefined,
      Promise.reject(new Error('connection reset')),
      userMessage,
      'space-1'
    )

    expect(createChatWithFirstMessage).toHaveBeenCalledWith(
      'chat-1',
      userMessage,
      'user-1',
      'Untitled',
      'space-1'
    )
  })

  it('saves the chat and its title but no answer when there is none', async () => {
    await persistStreamResults(
      null,
      'chat-1',
      'user-1',
      Promise.resolve('Title'),
      undefined,
      undefined,
      undefined,
      Promise.reject(new Error('connection reset')),
      userMessage,
      null
    )

    expect(createChatWithFirstMessage).toHaveBeenCalled()
    expect(upsertMessage).not.toHaveBeenCalled()
    expect(updateChatTitle).toHaveBeenCalledWith('chat-1', 'Title', 'user-1')
  })
})
