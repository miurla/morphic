import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { withRLS } from '@/lib/db/with-rls'
import { HL_START, HL_STOP } from '@/lib/render/highlight-markers'

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

  it('caps the query at the shared bound on a word boundary', async () => {
    const { where } = mockTitleQuery([])

    await searchChatTitles('user-1', 'note '.repeat(40) + 'kiwi')

    // 204 characters: the bound keeps the first 40 whole tokens and drops
    // 'kiwi', so title and content groups match the same effective query
    const rendered = dialect.sqlToQuery(where.mock.calls[0][0])
    expect(rendered.params).toContain(`%${'note '.repeat(40).trim()}%`)
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
        snippet: `Stopping by ${HL_START}woods${HL_STOP} on a snowy evening`
      }
    ])

    const result = await searchChatContent('user-1', 'woods')

    expect(result).toEqual([
      {
        chatId: 'chat-2',
        title: 'Poetry',
        snippet: `Stopping by ${HL_START}woods${HL_STOP} on a snowy evening`
      }
    ])
    expect(withRLS).toHaveBeenCalledWith('user-1', expect.any(Function))

    const rendered = dialect.sqlToQuery(execute.mock.calls[0][0])
    // full-text match on the message-text column only (not reasoning)
    expect(rendered.sql).toContain("to_tsvector('simple'")
    expect(rendered.sql).toContain('::tsquery')
    expect(rendered.sql).toContain('quote_nullable')
    expect(rendered.sql).not.toContain('plainto_tsquery')
    expect(rendered.sql).not.toContain("'english'")
    expect(rendered.sql).toMatch(/ts_headline\(\s*'simple'/)
    expect(rendered.sql).toContain('"search" @@')
    expect(rendered.sql).toContain('ts_rank')
    expect(rendered.sql).toContain('ts_headline')
    // highlight delimiters are control characters, not HTML
    expect(rendered.params).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`StartSel=${HL_START}, StopSel=${HL_STOP}`)
      ])
    )
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

  it('builds per-word groups with forward prefix and reverse prefixes', async () => {
    const execute = mockExecute([])

    await searchChatContent('user-1', 'chats')

    const rendered = dialect.sqlToQuery(execute.mock.calls[0][0])
    // forward prefix (word:*) plus exact proper prefixes of >= 3 chars,
    // AND-joined across words, so "chats" also finds "chat"
    expect(rendered.sql).toContain("quote_nullable(l) || ':*'")
    expect(rendered.sql).toContain('generate_series(3, length(l) - 1)')
    expect(rendered.sql).toContain("' & '")
  })

  it('passes operator characters through as bound parameters, never SQL', async () => {
    const execute = mockExecute([])

    await searchChatContent('user-1', 'Rust & Go | notes!')

    const rendered = dialect.sqlToQuery(execute.mock.calls[0][0])
    // the raw query reaches Postgres only as a parameter; the FTS parser
    // quotes it into inert lexemes (verified against PG 17)
    expect(rendered.params).toContain('Rust & Go | notes!')
    expect(rendered.sql).not.toContain('Rust')
  })

  it('returns empty for a punctuation-only query without erroring', async () => {
    const execute = mockExecute([])

    const result = await searchChatContent('user-1', '!!! ???')

    // the NULL-tsquery path is handled in SQL; no special case in TS
    expect(result).toEqual([])
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('caps the query length before the prefix expansion', async () => {
    const execute = mockExecute([])

    await searchChatContent('user-1', 'x'.repeat(500))

    // a long single token would expand into hundreds of prefix alternatives;
    // the bound query keeps the generated tsquery small
    const rendered = dialect.sqlToQuery(execute.mock.calls[0][0])
    const queryParam = rendered.params.find(
      p => typeof p === 'string' && p.includes('x')
    )
    expect(queryParam).toHaveLength(200)
  })

  it('truncates at a word boundary so no partial token broadens the match', async () => {
    const execute = mockExecute([])

    await searchChatContent('user-1', 'note '.repeat(40) + 'kiwi')

    // 'kiwi' falls past the cap and is dropped whole; the retained tokens are
    // all complete, so none acts as a broad prefix match
    const rendered = dialect.sqlToQuery(execute.mock.calls[0][0])
    const queryParam = rendered.params.find(
      p => typeof p === 'string' && p.includes('note')
    )
    expect(queryParam).toBe('note '.repeat(40).trim())
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
        snippet: `reasoning about ${HL_START}quasars${HL_STOP}`
      }
    ])

    const result = await searchChatReasoning('user-1', 'quasars')

    expect(result).toEqual([
      {
        chatId: 'chat-3',
        title: 'Thinking chat',
        snippet: `reasoning about ${HL_START}quasars${HL_STOP}`
      }
    ])

    const rendered = dialect.sqlToQuery(execute.mock.calls[0][0])
    expect(rendered.sql).toContain('"search_reasoning" @@')
    expect(rendered.sql).toContain('"reasoning_text"')
    expect(rendered.sql).not.toMatch(/"text_text"/)
    expect(rendered.sql).toContain("to_tsvector('simple'")
    expect(rendered.sql).toContain('::tsquery')
    expect(rendered.sql).not.toContain("'english'")
    expect(rendered.sql).toContain('c.user_id')
    expect(rendered.params).toContain('user-1')
  })
})
