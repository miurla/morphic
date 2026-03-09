'use client'

import Image from 'next/image'
import Link from 'next/link'

import { DiscoverArticle } from '@/lib/discover/fetch-articles'

interface DiscoverCardProps {
  article: DiscoverArticle
}

export function DiscoverCard({ article }: DiscoverCardProps) {
  const encodedQuery = encodeURIComponent(article.title)

  return (
    <Link
      href={`/?q=${encodedQuery}`}
      className="block rounded-xl overflow-hidden bg-card border border-border hover:border-primary/40 transition-colors group"
    >
      {article.image && (
        <div className="relative w-full aspect-video overflow-hidden bg-muted">
          <Image
            src={article.image}
            alt={article.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        </div>
      )}
      {!article.image && (
        <div className="w-full aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          <span className="text-muted-foreground text-xs">No image</span>
        </div>
      )}
      <div className="p-3">
        <h3 className="font-medium text-sm leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {article.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{article.source}</span>
        </div>
      </div>
    </Link>
  )
}
