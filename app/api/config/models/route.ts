import { NextResponse } from 'next/server'

import { getModels } from '@/lib/config/models'

export async function GET() {
  try {
    const models = await getModels()

    return NextResponse.json(
      { models },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=60', // Cache for 1 minute
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Failed to fetch models from /api/config/models:', error)
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    )
  }
}
