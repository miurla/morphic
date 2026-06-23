import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'

import { deleteNote, getNote, listNotes, saveNote } from '../notes'

vi.mock('@/lib/auth/get-current-user')
vi.mock('@/lib/db/actions')

const originalEnableAuth = process.env.ENABLE_AUTH

const note = {
  id: 'note-1',
  userId: 'user-1',
  chatId: 'chat-1',
  sourceMessageId: 'message-1',
  title: 'Saved answer',
  content: 'Saved answer content',
  createdAt: new Date('2026-06-17T00:00:00Z'),
  updatedAt: new Date('2026-06-17T00:00:00Z')
}

describe('Note Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENABLE_AUTH = 'true'
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    vi.mocked(dbActions.createNote).mockResolvedValue(note)
    vi.mocked(dbActions.getNotes).mockResolvedValue({
      notes: [note],
      nextCursor: null,
      hasMore: false
    })
    vi.mocked(dbActions.getNote).mockResolvedValue(note)
    vi.mocked(dbActions.deleteNote).mockResolvedValue({ success: true })
  })

  afterEach(() => {
    process.env.ENABLE_AUTH = originalEnableAuth
  })

  it('saves a markdown note for the current user', async () => {
    const result = await saveNote({
      content: '## **Saved answer**\n\nSaved answer content',
      chatId: 'chat-1',
      sourceMessageId: 'message-1'
    })

    expect(result).toEqual({ success: true, note })
    expect(dbActions.createNote).toHaveBeenCalledWith({
      userId: 'user-1',
      chatId: 'chat-1',
      sourceMessageId: 'message-1',
      title: 'Saved answer',
      content: '## **Saved answer**\n\nSaved answer content'
    })
  })

  it('rejects empty content', async () => {
    const result = await saveNote({ content: '   ' })

    expect(result).toEqual({ success: false, error: 'Nothing to save.' })
    expect(dbActions.createNote).not.toHaveBeenCalled()
  })

  it('rejects anonymous mode', async () => {
    process.env.ENABLE_AUTH = 'false'

    const result = await saveNote({ content: 'Saved answer' })

    expect(result).toEqual({
      success: false,
      error: 'Library is unavailable in anonymous mode.'
    })
    expect(dbActions.createNote).not.toHaveBeenCalled()
  })

  it('lists current user notes', async () => {
    const result = await listNotes()

    expect(result).toEqual({
      success: true,
      notes: [note],
      nextCursor: null,
      hasMore: false
    })
    expect(dbActions.getNotes).toHaveBeenCalledWith('user-1', {
      limit: 25,
      cursor: undefined
    })
  })

  it('lists current user notes from a cursor', async () => {
    const cursor = {
      updatedAt: '2026-06-17T00:00:00.000Z',
      id: 'note-1'
    }

    await listNotes({ limit: 10, cursor })

    expect(dbActions.getNotes).toHaveBeenCalledWith('user-1', {
      limit: 10,
      cursor
    })
  })

  it('loads a current user note', async () => {
    const result = await getNote('note-1')

    expect(result).toEqual({ success: true, note })
    expect(dbActions.getNote).toHaveBeenCalledWith('note-1', 'user-1')
  })

  it('deletes a current user note', async () => {
    const result = await deleteNote('note-1')

    expect(result).toEqual({ success: true })
    expect(dbActions.deleteNote).toHaveBeenCalledWith('note-1', 'user-1')
  })
})
