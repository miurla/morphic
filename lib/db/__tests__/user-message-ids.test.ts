import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/lib/db/schema'
import { withOptionalRLS } from '@/lib/db/with-rls'

import { getUserMessageIds } from '../actions'

vi.mock('@/lib/db/with-rls', () => ({
  withOptionalRLS: vi.fn(),
  withRLS: vi.fn()
}))

function mockQueries({
  chat,
  messageRows = []
}: {
  chat?: { userId: string; visibility: 'private' | 'public' }
  messageRows?: { id: string }[]
}) {
  const chatLimit = vi.fn().mockResolvedValue(chat ? [chat] : [])
  const chatsWhere = vi.fn().mockReturnValue({ limit: chatLimit })
  const messagesWhere = vi.fn().mockResolvedValue(messageRows)
  const from = vi
    .fn()
    .mockReturnValueOnce({ where: chatsWhere })
    .mockReturnValueOnce({ where: messagesWhere })
  const select = vi.fn().mockReturnValue({ from })

  vi.mocked(withOptionalRLS).mockImplementation(async (_userId, callback) =>
    callback({ select } as never)
  )

  return { select, messagesWhere }
}

describe('getUserMessageIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty list without querying messages when the chat is not found', async () => {
    const { select, messagesWhere } = mockQueries({})

    const result = await getUserMessageIds('chat-1', 'user-1')

    expect(result).toEqual([])
    expect(select).toHaveBeenCalledTimes(1)
    expect(messagesWhere).not.toHaveBeenCalled()
    expect(withOptionalRLS).toHaveBeenCalledWith('user-1', expect.any(Function))
  })

  it("returns an empty list without querying messages for another user's private chat", async () => {
    const { select, messagesWhere } = mockQueries({
      chat: { userId: 'user-2', visibility: 'private' }
    })

    const result = await getUserMessageIds('chat-1', 'user-1')

    expect(result).toEqual([])
    expect(select).toHaveBeenCalledTimes(1)
    expect(messagesWhere).not.toHaveBeenCalled()
    expect(withOptionalRLS).toHaveBeenCalledWith('user-1', expect.any(Function))
  })

  it('returns an empty list without querying messages for a private chat without a user ID', async () => {
    const { select, messagesWhere } = mockQueries({
      chat: { userId: 'user-1', visibility: 'private' }
    })

    const result = await getUserMessageIds('chat-1')

    expect(result).toEqual([])
    expect(select).toHaveBeenCalledTimes(1)
    expect(messagesWhere).not.toHaveBeenCalled()
    expect(withOptionalRLS).toHaveBeenCalledWith(null, expect.any(Function))
  })

  it('returns private chat message ids in order for the owner', async () => {
    const { select, messagesWhere } = mockQueries({
      chat: { userId: 'user-1', visibility: 'private' },
      messageRows: [{ id: 'message-2' }, { id: 'message-1' }]
    })

    const result = await getUserMessageIds('chat-1', 'user-1')

    expect(result).toEqual(['message-2', 'message-1'])
    expect(select).toHaveBeenCalledTimes(2)
    expect(messagesWhere).toHaveBeenCalledExactlyOnceWith(
      and(eq(messages.chatId, 'chat-1'), eq(messages.role, 'user'))
    )
    expect(withOptionalRLS).toHaveBeenCalledWith('user-1', expect.any(Function))
  })

  it('returns public chat message ids for a different user', async () => {
    const { select, messagesWhere } = mockQueries({
      chat: { userId: 'user-2', visibility: 'public' },
      messageRows: [{ id: 'message-1' }, { id: 'message-2' }]
    })

    const result = await getUserMessageIds('chat-1', 'user-1')

    expect(result).toEqual(['message-1', 'message-2'])
    expect(select).toHaveBeenCalledTimes(2)
    expect(messagesWhere).toHaveBeenCalledTimes(1)
    expect(withOptionalRLS).toHaveBeenCalledWith('user-1', expect.any(Function))
  })

  it('maps message rows to a plain string array', async () => {
    mockQueries({
      chat: { userId: 'user-1', visibility: 'private' },
      messageRows: [{ id: 'message-1' }, { id: 'message-2' }]
    })

    const result = await getUserMessageIds('chat-1', 'user-1')

    expect(result).toEqual(['message-1', 'message-2'])
    expect(result.every(id => typeof id === 'string')).toBe(true)
    expect(withOptionalRLS).toHaveBeenCalledWith('user-1', expect.any(Function))
  })
})
