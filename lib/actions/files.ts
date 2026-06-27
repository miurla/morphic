'use server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import type { LibraryFile } from '@/lib/db/schema'
import { getSignedFileUrl } from '@/lib/storage/r2-client'

const DEFAULT_FILES_PAGE_SIZE = 25

export type FilesListCursor = {
  updatedAt: string
  id: string
}

export type LibraryFileItem = LibraryFile & {
  key: string
  url: string
}

async function signLibraryFile(file: LibraryFile): Promise<LibraryFileItem> {
  return {
    ...file,
    key: file.objectKey,
    url: await getSignedFileUrl(file.objectKey)
  }
}

async function signLibraryFiles(
  files: LibraryFile[]
): Promise<LibraryFileItem[]> {
  return Promise.all(files.map(file => signLibraryFile(file)))
}

async function requireLibraryFileUserId() {
  if (process.env.ENABLE_AUTH === 'false') {
    return {
      userId: null,
      error: 'Library is unavailable in anonymous mode.'
    }
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return { userId: null, error: 'Sign in to use library files.' }
  }

  return { userId, error: null }
}

export async function listFiles({
  limit = DEFAULT_FILES_PAGE_SIZE,
  cursor
}: {
  limit?: number
  cursor?: FilesListCursor | null
} = {}): Promise<{
  success: boolean
  files?: LibraryFileItem[]
  nextCursor?: FilesListCursor | null
  hasMore?: boolean
  error?: string
}> {
  const { userId, error } = await requireLibraryFileUserId()
  if (!userId) {
    return {
      success: false,
      files: [],
      error: error ?? 'User not authenticated'
    }
  }

  try {
    const page = await dbActions.getLibraryFiles(userId, {
      limit,
      cursor: cursor ?? undefined
    })
    return {
      success: true,
      files: await signLibraryFiles(page.files),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore
    }
  } catch (error) {
    console.error('Error listing files:', error)
    return {
      success: false,
      files: [],
      nextCursor: null,
      hasMore: false,
      error: 'Failed to load files.'
    }
  }
}

export async function searchFiles({
  query,
  limit = DEFAULT_FILES_PAGE_SIZE
}: {
  query: string
  limit?: number
}): Promise<{ success: boolean; files?: LibraryFileItem[]; error?: string }> {
  const { userId, error } = await requireLibraryFileUserId()
  if (!userId) {
    return {
      success: false,
      files: [],
      error: error ?? 'User not authenticated'
    }
  }

  try {
    const files = await dbActions.searchLibraryFiles(userId, query, { limit })
    return { success: true, files: await signLibraryFiles(files) }
  } catch (error) {
    console.error('Error searching files:', error)
    return { success: false, files: [], error: 'Failed to search files.' }
  }
}

export async function deleteFile(
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  const { userId, error } = await requireLibraryFileUserId()
  if (!userId) {
    return { success: false, error: error ?? 'User not authenticated' }
  }

  return dbActions.deleteLibraryFile(fileId, userId)
}
