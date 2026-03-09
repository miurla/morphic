import { NextRequest, NextResponse } from 'next/server'

import {
  DiscoverArticle,
  fetchDiscoverArticles
} from '@/lib/discover/fetch-articles'

export type { DiscoverArticle }

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'for-you'

  try {
    const articles = await fetchDiscoverArticles(category)
    return NextResponse.json({ articles })
  } catch (error) {
    console.error('Discover API error:', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
