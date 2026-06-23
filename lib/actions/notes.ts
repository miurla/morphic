'use server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import type { Note } from '@/lib/db/schema'

const MAX_TITLE_LENGTH = 120

function stripMarkdownTitle(value: string) {
  return value
    .replace(/^#{1,6}\s+/, '')
    .replace(/[*_~`>#\[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function deriveTitle(content: string, title?: string) {
  const candidate = stripMarkdownTitle(
    title?.trim() ||
      content
        .split('\n')
        .map(line => stripMarkdownTitle(line))
        .find(Boolean) ||
      'Untitled note'
  )

  return candidate.length > MAX_TITLE_LENGTH
    ? `${candidate.slice(0, MAX_TITLE_LENGTH - 1)}...`
    : candidate
}

async function requireNoteUserId() {
  if (process.env.ENABLE_AUTH === 'false') {
    return {
      userId: null,
      error: 'Library is unavailable in anonymous mode.'
    }
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return { userId: null, error: 'Sign in to save notes.' }
  }

  return { userId, error: null }
}

export async function saveNote({
  content,
  title,
  chatId,
  sourceMessageId
}: {
  content: string
  title?: string
  chatId?: string
  sourceMessageId?: string
}): Promise<{ success: boolean; note?: Note; error?: string }> {
  const trimmedContent = content.trim()
  if (!trimmedContent) {
    return { success: false, error: 'Nothing to save.' }
  }

  const { userId, error } = await requireNoteUserId()
  if (!userId) {
    return { success: false, error: error ?? 'User not authenticated' }
  }

  try {
    const note = await dbActions.createNote({
      userId,
      chatId: chatId || null,
      sourceMessageId: sourceMessageId || null,
      title: deriveTitle(trimmedContent, title),
      content: trimmedContent
    })
    return { success: true, note }
  } catch (error) {
    console.error('Error saving note:', error)
    return { success: false, error: 'Failed to save note.' }
  }
}

export async function listNotes(): Promise<{
  success: boolean
  notes?: Note[]
  error?: string
}> {
  const { userId, error } = await requireNoteUserId()
  if (!userId) {
    return {
      success: false,
      notes: [],
      error: error ?? 'User not authenticated'
    }
  }

  try {
    const notes = await dbActions.getNotes(userId)
    return { success: true, notes }
  } catch (error) {
    console.error('Error listing notes:', error)
    return { success: false, notes: [], error: 'Failed to load notes.' }
  }
}

export async function getNote(
  noteId: string
): Promise<{ success: boolean; note?: Note | null; error?: string }> {
  const { userId, error } = await requireNoteUserId()
  if (!userId) {
    return {
      success: false,
      note: null,
      error: error ?? 'User not authenticated'
    }
  }

  try {
    const note = await dbActions.getNote(noteId, userId)
    return { success: true, note }
  } catch (error) {
    console.error('Error loading note:', error)
    return { success: false, note: null, error: 'Failed to load note.' }
  }
}

export async function deleteNote(
  noteId: string
): Promise<{ success: boolean; error?: string }> {
  const { userId, error } = await requireNoteUserId()
  if (!userId) {
    return { success: false, error: error ?? 'User not authenticated' }
  }

  return dbActions.deleteNote(noteId, userId)
}
