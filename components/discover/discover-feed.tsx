import { DiscoverArticle } from '@/lib/discover/fetch-articles'

import { DiscoverCard } from './discover-card'

interface DiscoverFeedProps {
  articles: DiscoverArticle[]
}

export function DiscoverFeed({ articles }: DiscoverFeedProps) {
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No articles found. Try another category.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {articles.map((article, index) => (
        <DiscoverCard key={index} article={article} />
      ))}
    </div>
  )
}
