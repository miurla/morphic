import { Suspense } from 'react'

import { fetchDiscoverArticles } from '@/lib/discover/fetch-articles'

import { DiscoverFeed } from '@/components/discover/discover-feed'
import { DiscoverTabs } from '@/components/discover/discover-tabs'

export const metadata = {
  title: "Discover | Borsatti's"
}

export default async function DiscoverPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const params = await searchParams
  const category = params.category || 'for-you'
  const articles = await fetchDiscoverArticles(category)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-0">
        <h1 className="font-display text-2xl mb-4">Discover</h1>
        <Suspense>
          <DiscoverTabs />
        </Suspense>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <DiscoverFeed articles={articles} />
      </div>
    </div>
  )
}
