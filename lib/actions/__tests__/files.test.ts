import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import { getSignedFileUrl } from '@/lib/storage/r2-client'

import { deleteFile, listFiles, searchFiles } from '../files'

vi.mock('@/lib/auth/get-current-user')
vi.mock('@/lib/db/actions')
vi.mock('@/lib/storage/r2-client')

const originalEnableAuth = process.env.ENABLE_AUTH

const libraryFile = {
  id: 'file-1',
  userId: 'user-1',
  chatId: 'chat-1',
  filename: 'report.pdf',
  objectKey: 'user-1/chats/chat-1/report.pdf',
  mediaType: 'application/pdf',
  size: 1024,
  createdAt: new Date('2026-06-24T00:00:00Z'),
  updatedAt: new Date('2026-06-24T00:00:00Z')
}

describe('File Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENABLE_AUTH = 'true'
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
    vi.mocked(dbActions.getLibraryFiles).mockResolvedValue({
      files: [libraryFile],
      nextCursor: null,
      hasMore: false
    })
    vi.mocked(dbActions.searchLibraryFiles).mockResolvedValue([libraryFile])
    vi.mocked(dbActions.deleteLibraryFile).mockResolvedValue({ success: true })
    vi.mocked(getSignedFileUrl).mockResolvedValue(
      'https://signed.example.com/report.pdf'
    )
  })

  afterEach(() => {
    process.env.ENABLE_AUTH = originalEnableAuth
  })

  it('lists current user files', async () => {
    const result = await listFiles()

    expect(result).toEqual({
      success: true,
      files: [
        {
          ...libraryFile,
          key: 'user-1/chats/chat-1/report.pdf',
          url: 'https://signed.example.com/report.pdf'
        }
      ],
      nextCursor: null,
      hasMore: false
    })
    expect(dbActions.getLibraryFiles).toHaveBeenCalledWith('user-1', {
      limit: 25,
      cursor: undefined
    })
  })

  it('searches current user files', async () => {
    const result = await searchFiles({ query: 'report', limit: 5 })

    expect(result).toEqual({
      success: true,
      files: [
        {
          ...libraryFile,
          key: 'user-1/chats/chat-1/report.pdf',
          url: 'https://signed.example.com/report.pdf'
        }
      ]
    })
    expect(dbActions.searchLibraryFiles).toHaveBeenCalledWith(
      'user-1',
      'report',
      { limit: 5 }
    )
  })

  it('deletes a current user file', async () => {
    const result = await deleteFile('file-1')

    expect(result).toEqual({ success: true })
    expect(dbActions.deleteLibraryFile).toHaveBeenCalledWith('file-1', 'user-1')
  })

  it('rejects anonymous mode', async () => {
    process.env.ENABLE_AUTH = 'false'

    const result = await listFiles()

    expect(result).toEqual({
      success: false,
      files: [],
      error: 'Library is unavailable in anonymous mode.'
    })
    expect(dbActions.getLibraryFiles).not.toHaveBeenCalled()
  })
})
