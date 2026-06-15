import {
  extractReadableText,
  isReaderSupportedContentType,
  normalizeReaderRequest
} from '@/lib/sources/reader'
import {
  readResponseWithLimit,
  safeFetch,
  SSRFError
} from '@/lib/utils/ssrf-guard'

const READER_RESPONSE_BYTES = 1_000_000

function requestToReaderInput(req: Request) {
  const url = new URL(req.url)
  return {
    url: url.searchParams.get('url') ?? undefined,
    title: url.searchParams.get('title') ?? undefined,
    siteName: url.searchParams.get('siteName') ?? undefined,
    sourceId: url.searchParams.get('sourceId') ?? undefined
  }
}

export async function GET(req: Request) {
  const readerRequest = normalizeReaderRequest(requestToReaderInput(req))
  if (!readerRequest) {
    return Response.json(
      { ok: false, error: 'A valid source URL is required' },
      { status: 400 }
    )
  }

  try {
    const response = await safeFetch(readerRequest.url, {
      maxRedirects: 3,
      maxResponseBytes: READER_RESPONSE_BYTES,
      headers: {
        Accept:
          'text/html,application/xhtml+xml,text/plain;q=0.9,application/xml;q=0.5',
        'User-Agent': 'Mozilla/5.0 (compatible; MorphicReader/1.0)'
      }
    })

    if (!response.ok) {
      return Response.json(
        { ok: false, error: `Source returned HTTP ${response.status}` },
        { status: response.status >= 400 && response.status < 600 ? 502 : 500 }
      )
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!isReaderSupportedContentType(contentType)) {
      return Response.json(
        { ok: false, error: 'Unsupported content type' },
        { status: 415 }
      )
    }

    const body = await readResponseWithLimit(response, READER_RESPONSE_BYTES)
    const readable = extractReadableText(
      body,
      response.url || readerRequest.url
    )

    return Response.json({
      ok: true,
      reader: {
        ...readable,
        url: readerRequest.url,
        sourceId: readerRequest.sourceId,
        siteName: readerRequest.siteName,
        requestedTitle: readerRequest.title
      }
    })
  } catch (error) {
    if (error instanceof SSRFError || (error as Error)?.name === 'SSRFError') {
      return Response.json(
        { ok: false, error: 'Source URL is not allowed' },
        { status: 400 }
      )
    }

    console.error('Reader API error:', error)
    return Response.json(
      { ok: false, error: 'Failed to load source' },
      { status: 500 }
    )
  }
}
