'use client'

import {
  ExternalLink,
  Heart,
  Lightbulb,
  MessageCircle,
  Repeat2,
  TrendingUp,
  Users
} from 'lucide-react'

import { useChatContext } from '@/lib/contexts/chat-context'
import { cn } from '@/lib/utils'

import { Button } from '../ui/button'

type Post = {
  author_name?: string
  author_headline?: string
  text_preview?: string
  share_url?: string
  reactions?: number
  comments?: number
  reposts?: number
  engagement_score?: number
  date?: string
  has_media?: boolean
}

type Highlight = {
  author?: string
  topic?: string
  engagement?: string
  why_relevant?: string
}

type FeedBriefing = {
  highlights?: Highlight[]
  trending_topics?: string[]
  key_people?: string[]
  opportunities?: string[]
  recommended_actions?: string[]
}

type SearchMeta = {
  total_found?: number
  period?: string
  topic?: string
  summary?: string
  elapsed_seconds?: number
}

type SmartNetworkUpdateOutput = {
  posts?: Post[]
  feed_briefing?: FeedBriefing
  search_meta?: SearchMeta
}

function formatDate(d?: string): string | null {
  if (!d) return null
  const date = new Date(d)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  if (diff < 7) return `${diff}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function PostCard({ post }: { post: Post }) {
  const date = formatDate(post.date)

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
          {post.author_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {post.author_name ?? 'Inconnu'}
            </span>
            {date && (
              <span className="text-xs text-muted-foreground shrink-0">
                {date}
              </span>
            )}
          </div>
          {post.author_headline && (
            <p className="text-xs text-muted-foreground truncate">
              {post.author_headline}
            </p>
          )}
        </div>
        {post.share_url && (
          <a
            href={post.share_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {post.text_preview && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {post.text_preview}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {post.reactions != null && (
          <span className="flex items-center gap-1">
            <Heart className="size-3" />
            {post.reactions}
          </span>
        )}
        {post.comments != null && (
          <span className="flex items-center gap-1">
            <MessageCircle className="size-3" />
            {post.comments}
          </span>
        )}
        {post.reposts != null && post.reposts > 0 && (
          <span className="flex items-center gap-1">
            <Repeat2 className="size-3" />
            {post.reposts}
          </span>
        )}
      </div>
    </div>
  )
}

export function MelronNetworkUpdateResult({ data }: { data: unknown }) {
  const d = (data ?? {}) as SmartNetworkUpdateOutput
  const posts = d.posts ?? []
  const briefing = d.feed_briefing
  const meta = d.search_meta
  const { sendMessage } = useChatContext()

  const topPosts = posts.slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Summary */}
      {meta?.summary && (
        <p className="text-sm leading-relaxed">{meta.summary}</p>
      )}

      {/* Trending topics */}
      {briefing?.trending_topics && briefing.trending_topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {briefing.trending_topics.map((t, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Top posts */}
      {topPosts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <TrendingUp className="size-3" />
            Top posts ({meta?.total_found ?? posts.length} trouvés)
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {topPosts.map((post, i) => (
              <PostCard key={i} post={post} />
            ))}
          </div>
        </div>
      )}

      {/* Opportunities */}
      {briefing?.opportunities && briefing.opportunities.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lightbulb className="size-3" />
            Opportunités détectées
          </div>
          <div className="space-y-1">
            {briefing.opportunities.map((o, i) => (
              <div
                key={i}
                className="text-xs text-muted-foreground flex items-start gap-1.5"
              >
                <span className="text-primary mt-0.5">•</span>
                <span>{o}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key people */}
      {briefing?.key_people && briefing.key_people.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="size-3" />
            Personnes clés
          </div>
          <div className="space-y-1">
            {briefing.key_people.map((p, i) => (
              <div
                key={i}
                className="text-xs text-muted-foreground flex items-start gap-1.5"
              >
                <span className="text-primary mt-0.5">•</span>
                <span>{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() =>
            sendMessage({
              role: 'user',
              parts: [
                {
                  type: 'text',
                  text: 'Planifier un post LinkedIn basé sur les tendances de mon réseau'
                }
              ]
            })
          }
        >
          <MessageCircle className="size-3" />
          Planifier un post
        </Button>
      </div>
    </div>
  )
}
