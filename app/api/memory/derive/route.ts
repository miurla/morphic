import { NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { deriveMemoryForUser } from '@/lib/memory/derive'

export async function POST() {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await deriveMemoryForUser(userId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[memory/derive] Error:', error)
    return NextResponse.json(
      { error: 'Derivation failed' },
      { status: 500 }
    )
  }
}
