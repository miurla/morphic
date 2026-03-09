'use server'

import { revalidateTag } from 'next/cache'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import { generateId } from '@/lib/db/schema'

export async function getProjects() {
  const userId = await getCurrentUserId()
  if (!userId) return []
  return dbActions.getProjects(userId)
}

export async function getProject(projectId: string) {
  const userId = await getCurrentUserId()
  if (!userId) return undefined
  return dbActions.getProject(projectId, userId)
}

export async function getProjectWithChats(projectId: string) {
  const userId = await getCurrentUserId()
  if (!userId) return undefined
  return dbActions.getProjectWithChats(projectId, userId)
}

export async function createProject(name: string, description?: string) {
  const userId = await getCurrentUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }
  const project = await dbActions.createProject({
    id: generateId(),
    name,
    userId,
    description
  })
  revalidateTag('projects', 'max')
  return { success: true, project }
}

export async function updateProject(
  projectId: string,
  updates: { name?: string; description?: string; instructions?: string }
) {
  const userId = await getCurrentUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }
  const project = await dbActions.updateProject(projectId, userId, updates)
  if (!project) return { success: false, error: 'Project not found' }
  revalidateTag(`project-${projectId}`, 'max')
  revalidateTag('projects', 'max')
  return { success: true, project }
}

export async function deleteProject(projectId: string) {
  const userId = await getCurrentUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }
  const result = await dbActions.deleteProject(projectId, userId)
  if (!result.success) return { success: false, error: 'Project not found' }
  revalidateTag(`project-${projectId}`, 'max')
  revalidateTag('projects', 'max')
  return { success: true }
}

export async function updateChatProject(
  chatId: string,
  projectId: string | null
) {
  const userId = await getCurrentUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }
  const chat = await dbActions.updateChatProject(chatId, userId, projectId)
  if (!chat) return { success: false, error: 'Chat not found' }
  revalidateTag('chat', 'max')
  if (projectId) revalidateTag(`project-${projectId}`, 'max')
  return { success: true, chat }
}
