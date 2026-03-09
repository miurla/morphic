export interface DiscoverArticle {
  title: string
  url: string
  content: string
  image?: string
  source: string
  publishedDate?: string
}

const CATEGORY_QUERIES: Record<string, string> = {
  'for-you': 'luxury fashion haute couture designer news latest 2025',
  runway: 'runway show haute couture ready-to-wear fashion week 2025',
  accessories: 'luxury handbags shoes jewellery watches accessories 2025',
  brands: 'luxury fashion house heritage brand story designer 2025',
  sustainability: 'sustainable luxury fashion ethical slow fashion 2025',
  business:
    'luxury fashion business mergers acquisitions LVMH Kering revenue earnings 2025'
}

function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url)
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export async function fetchDiscoverArticles(
  category: string
): Promise<DiscoverArticle[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return []

  const query = CATEGORY_QUERIES[category] ?? CATEGORY_QUERIES['for-you']

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 10,
        search_depth: 'basic',
        include_images: true,
        include_image_descriptions: true,
        include_answers: false,
        topic: 'news'
      })
    })

    if (!response.ok) return []

    const data = await response.json()

    const imageUrls: string[] = []
    if (Array.isArray(data.images)) {
      for (const img of data.images) {
        if (typeof img === 'object' && img.url) {
          imageUrls.push(img.url as string)
        } else if (typeof img === 'string') {
          imageUrls.push(img)
        }
      }
    }

    return (data.results ?? []).slice(0, 10).map(
      (
        result: {
          title: string
          url: string
          content: string
          published_date?: string
        },
        index: number
      ) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        source: extractDomain(result.url),
        publishedDate: result.published_date,
        image:
          imageUrls.length > 0 ? imageUrls[index % imageUrls.length] : undefined
      })
    )
  } catch {
    return []
  }
}
