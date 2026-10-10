import { asc } from 'drizzle-orm'

import { db } from '@/lib/db'

import { user } from './schema'

export interface MemberSummary {
  id: string
  email: string
  name: string | null
  role: string | null
}

export async function listMembers(): Promise<MemberSummary[]> {
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    })
    .from(user)
    .orderBy(asc(user.createdAt))

  return rows.map(row => ({
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    role: row.role ?? null
  }))
}
