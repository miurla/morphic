import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import {
  ENFORCEMENT,
  getUsageBudget,
  isUsageBudgetAvailable,
  UI_ENABLED
} from '@/lib/usage-budget'

export async function GET() {
  if (!isUsageBudgetAvailable() || ENFORCEMENT !== 'on' || !UI_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const usage = await getUsageBudget({
    userId: user.id,
    userCreatedAt: user.created_at
  })
  if (!usage) {
    return NextResponse.json(
      { error: 'Usage is temporarily unavailable' },
      { status: 503 }
    )
  }

  return NextResponse.json({
    ...usage,
    resetAt: new Date(usage.resetAt).toISOString(),
    ...(usage.refreshAt && {
      refreshAt: new Date(usage.refreshAt).toISOString()
    })
  })
}
