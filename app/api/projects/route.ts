import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/db/actions'
import { generateId } from '@/lib/db/schema'

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ projects: [] })
  }
  const projects = await dbActions.getProjects(userId)
  return NextResponse.json({ projects })
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const body = await request.json()
  const { name, description } = body as {
    name: string
    description?: string
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const project = await dbActions.createProject({
    id: generateId(),
    name: name.trim(),
    userId,
    description
  })
  return NextResponse.json({ project }, { status: 201 })
}
