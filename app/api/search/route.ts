import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  searchChatContent,
  searchChatReasoning,
  searchChatTitles
} from '@/lib/db/actions'
import { stripHighlightMarkers } from '@/lib/render/highlight-markers'
import {
  MIN_QUERY_LENGTH,
  normalizeSearchQuery
} from '@/lib/utils/search-query'
const TITLE_LIMIT = 20
const CONTENT_LIMIT = 20
const REASONING_LIMIT = 10

type ContentSearchItem = {
  chatId: string
  title: string
  snippet: string
  highlight: string
}

interface SearchResponse {
  title: { chatId: string; title: string }[]
  content: ContentSearchItem[]
  thinking?: ContentSearchItem[]
}

// ts_headline wraps matched terms in HL_START/HL_STOP control characters;
// keep them for the `highlight` field and strip them for the plain `snippet`
// field. Literal HTML in message text is therefore never altered or emphasized.
function toContentItem(result: {
  chatId: string
  title: string
  snippet: string
}): ContentSearchItem {
  return {
    chatId: result.chatId,
    title: result.title,
    snippet: stripHighlightMarkers(result.snippet),
    highlight: result.snippet
  }
}

export async function GET(request: NextRequest) {
  const emptyResponse: SearchResponse = { title: [], content: [] }

  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json<SearchResponse>(emptyResponse)
  }

  const { searchParams } = new URL(request.url)
  // Normalize once here so the minimum applies to the query the search
  // actually runs: a long paste can normalize below the minimum (e.g. 'a '
  // plus a token crossing the cap), and the actions would then run a very
  // broad single-character search despite the advertised minimum.
  const query = normalizeSearchQuery(searchParams.get('q') ?? '')
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json<SearchResponse>(emptyResponse)
  }

  try {
    const includeReasoning = searchParams.get('include') === 'reasoning'

    const [titleChats, contentMatches, reasoningMatches] = await Promise.all([
      searchChatTitles(userId, query, TITLE_LIMIT),
      searchChatContent(userId, query, CONTENT_LIMIT),
      includeReasoning
        ? searchChatReasoning(userId, query, REASONING_LIMIT)
        : Promise.resolve(null)
    ])

    const payload: SearchResponse = {
      title: titleChats.map(chat => ({ chatId: chat.id, title: chat.title })),
      content: contentMatches.map(toContentItem)
    }
    if (reasoningMatches) {
      payload.thinking = reasoningMatches.map(toContentItem)
    }

    return NextResponse.json<SearchResponse>(payload)
  } catch (error) {
    console.error('API route error searching chats:', error)
    return NextResponse.json<SearchResponse>(emptyResponse, { status: 500 })
  }
}
