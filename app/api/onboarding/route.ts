import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    const profiles = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)

    if (profiles.length === 0) {
      return NextResponse.json({
        onboardingCompleted: false,
        onboardingStep: 0
      })
    }

    // Sync cookie with DB state
    if (profiles[0].onboardingCompleted) {
      const cookieStore = await cookies()
      cookieStore.set('onboarding_completed', 'true', {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: false
      })
    }

    return NextResponse.json(profiles[0])
  } catch (error) {
    console.error('[onboarding] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()


    const existing = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(userProfiles).values({
        userId,
        ...body,
        updatedAt: new Date()
      })
    } else {
      await db
        .update(userProfiles)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(userProfiles.userId, userId))
    }

    // Set cookie when onboarding is completed
    if (body.onboardingCompleted) {
      const cookieStore = await cookies()
      cookieStore.set('onboarding_completed', 'true', {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: false
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[onboarding] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
