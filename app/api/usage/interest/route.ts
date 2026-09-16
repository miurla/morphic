import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import {
  ENFORCEMENT,
  isUsageBudgetAvailable,
  recordAdditionalUsageInterest,
  UI_ENABLED
} from '@/lib/usage-budget'

export async function POST() {
  if (!isUsageBudgetAvailable() || ENFORCEMENT !== 'on' || !UI_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await recordAdditionalUsageInterest(user.id)
    return NextResponse.json({ recorded: true })
  } catch (error) {
    console.error('Failed to record additional usage interest:', error)
    return NextResponse.json(
      { error: 'Failed to record interest' },
      { status: 500 }
    )
  }
}
