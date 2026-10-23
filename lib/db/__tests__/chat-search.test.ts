import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { withRLS } from '@/lib/db/with-rls'

import {
  searchChatContent,
  searchChatReasoning,
  searchChatTitles
} from '../actions'

vi.mock('@/lib/db/with-rls', () => ({
  withOptionalRLS: vi.fn(),
  withRLS: vi.fn()
}))

const dialect = new PgDialect()

function mockTitleQuery(rows: unknown[] = []) {
  const limit = vi.fn().mockResolvedValue(rows)
  const orderBy = vi.fn().mockReturnValue({ limit })
  const where = vi.fn().mockReturnValue({ orderBy })
  const from = vi.fn().mockReturnValue({ where })
  const select = vi.fn().mockReturnValue({ from })

  vi.mocked(withRLS).mockImplementation(async (_userId, callback) =>
    callback({ select } as never)
  )

  return { select, where, orderBy, limit }
}

function mockExecute(rows: unknown[] = []) {
  const execute = vi.fn().mockResolvedValue(rows)

  vi.mocked(withRLS).mockImplementation(async (_userId, callback) =>
    callback({ execute } as never)
  )

  return execute
}

describe('searchChatTitles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty list without querying for a blank query', async () => {
    const result = await searchChatTitles('user-1', '   ')

    expect(result).toEqual([])
    expect(withRLS).not.toHaveBeenCalled()
  })

  it('matches titles case-insensitively under the user RLS scope', async () => {
    const chat = { id: 'chat-1', title: 'Robert Frost Readings' }
    const { where } = mockTitleQuery([chat])

    const result = await searchChatTitles('user-1', 'frost')

    expect(result).toEqual([chat])
    expect(withRLS).toHaveBeenCalledWith('user-1', expect.any(Function))

    const rendered = dialect.sqlToQuery(where.mock.calls[0][0])
    expect(rendered.sql).toContain('ilike')
    expect(rendered.sql).toContain('"title"')
    expect(rendered.params).toContain('%frost%')
    // user scoping: only the requesting user's chats
    expect(rendered.sql).toContain('"user_id"')
    expect(rendered.params).toContain('user-1')
  })

  it('orders newest first and applies the limit', async () => {
    const { orderBy, limit } = mockTitleQuery([])

    await searchChatTitles('user-1', 'frost', 20)

    const rendered = dialect.sqlToQuery(orderBy.mock.calls[0][0])
    expect(rendered.sql).toContain('desc')
    expect(rendered.sql).toContain('"created_at"')
    expect(limit).toHaveBeenCalledWith(20)
  })

  it('escapes ILIKE wildcards so the query matches literally', async () => {
    const { where } = mockTitleQuery([])

    await searchChatTitles('user-1', '100%')

    const rendered = dialect.sqlToQuery(where.mock.calls[0][0])
    // "%" is backslash-escaped, so it cannot act as a wildcard
    expect(rendered.params).toContain('%100\\%%')
  })
})

describe('searchChatContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty list without querying for a blank query', async () => {
    const result = await searchChatContent('user-1', '')

    expect(result).toEqual([])
    expect(withRLS).not.toHaveBeenCalled()
  })

  it('runs a tsquery match scoped to the user and maps rows', async () => {
    const execute = mockExecute([
      {
        chat_id: 'chat-2',
        title: 'Poetry',
        snippet: 'Stopping by <b>woods</b> on a snowy evening'
      }
    ])

    const result = await searchChatContent('user-1', 'woods')

    expect(result).toEqual([
      {
        chatId: 'chat-2',
        title: 'Poetry',
        snippet: 'Stopping by <b>woods</b> on a snowy evening'
      }
    ])
    expect(withRLS).toHaveBeenCalledWith('user-1', expect.any(Function))

    const rendered = dialect.sqlToQuery(execute.mock.calls[0][0])
    // full-text match on the message-text column only (not reasoning)
    expect(rendered.sql).toContain('plainto_tsquery')
    expect(rendered.sql).toContain('"search" @@')
    expect(rendered.sql).toContain('ts_rank')
    expect(rendered.sql).toContain('ts_headline')
    expect(rendered.sql).toContain('"text_text"')
    expect(rendered.sql).not.toContain('"search_reasoning"')
    // user scoping: excludes other users' chats even when public
    expect(rendered.sql).toContain('c.user_id')
    expect(rendered.params).toContain('user-1')
    expect(rendered.params).toContain('woods')
    // matches both user questions and assistant answers: no role filter
    expect(rendered.sql).not.toContain('role')
  })

  it('keeps the best-scoring part per chat, newest-first tie-break, capped', async () => {
    const execute = mockExecute([])

    await searchChatContent('user-1', 'woods', 20)

    const rendered = dialect.sqlToQuery(execute.mock.calls[0][0])
    expect(rendered.sql).toContain('DISTINCT ON (c.id)')
    // per-chat best score first, then overall ranking with newest chats first
    expect(rendered.sql).toContain('ORDER BY c.id, match_rank DESC')
    expect(rendered.sql).toContain(
      'ORDER BY match_rank DESC, chat_created_at DESC'
    )
    expect(rendered.params).toContain(20)
  })
})

describe('searchChatReasoning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty list without querying for a blank query', async () => {
    const result = await searchChatReasoning('user-1', '  ')

    expect(result).toEqual([])
    expect(withRLS).not.toHaveBeenCalled()
  })

  it('matches the reasoning column only and maps rows', async () => {
    const execute = mockExecute([
      {
        chat_id: 'chat-3',
        title: 'Thinking chat',
        snippet: 'reasoning about <b>quasars</b>'
      }
    ])

    const result = await searchChatReasoning('user-1', 'quasars')

    expect(result).toEqual([
      {
        chatId: 'chat-3',
        title: 'Thinking chat',
        snippet: 'reasoning about <b>quasars</b>'
      }
    ])

    const rendered = dialect.sqlToQuery(execute.mock.calls[0][0])
    expect(rendered.sql).toContain('"search_reasoning" @@')
    expect(rendered.sql).toContain('"reasoning_text"')
    expect(rendered.sql).not.toMatch(/"text_text"/)
    expect(rendered.sql).toContain('c.user_id')
    expect(rendered.params).toContain('user-1')
  })
})
