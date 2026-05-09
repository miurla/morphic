'use client'

import {
  ExternalLink,
  MapPin,
  MessageSquare,
  Sparkles,
  User,
  Users
} from 'lucide-react'

import { useChatContext } from '@/lib/contexts/chat-context'
import { cn } from '@/lib/utils'

type Person = {
  full_name?: string
  anonymized_name?: string
  headline?: string
  location?: string
  profile_url?: string
  relevance_score?: number
  network_distance?: string
  is_founder?: boolean
  is_cxo?: boolean
  match_reasons?: string[]
  signals?: {
    open_to_work?: boolean
    premium?: boolean
    open_profile?: boolean
    can_send_inmail?: boolean
  }
}

type SearchMeta = {
  total_found?: number
  total_analyzed?: number
  curated_count?: number
  elapsed_seconds?: number
  summary?: string
}

type NetworkBriefing = {
  ecosystem_insight?: string
  key_connections?: string
  patterns_detected?: string
  next_actions?: string[]
  recommendations?: string[]
}

type SmartPeopleSearchOutput = {
  people?: Person[]
  search_meta?: SearchMeta
  network_briefing?: NetworkBriefing
}

function getDisplayName(p: Person): string {
  if (p.full_name && p.full_name !== 'Utilisateur LinkedIn') return p.full_name
  return p.anonymized_name ?? 'Profil LinkedIn'
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

function distanceLabel(d?: string): string | null {
  if (!d) return null
  if (d === '1') return '1er'
  if (d === '2') return '2e'
  if (d === '3') return '3e'
  if (d === 'out_of_network') return 'Hors réseau'
  return d
}

export function MelronPeopleSearchResult({ data }: { data: unknown }) {
  const d = (data ?? {}) as SmartPeopleSearchOutput
  const people = d.people ?? []
  const meta = d.search_meta
  const { selectedItem, setSelectedItem } = useChatContext()

  if (people.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3">
        Aucun profil trouvé.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {meta && (
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 px-1">
          {meta.total_found != null && (
            <span>{meta.total_found} profils trouvés</span>
          )}
          {meta.curated_count != null && (
            <span>{meta.curated_count} affichés</span>
          )}
          {meta.elapsed_seconds != null && (
            <span>{meta.elapsed_seconds}s</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {people.map((person, i) => {
          const name = getDisplayName(person)
          const initials = getInitials(name)
          const distance = distanceLabel(person.network_distance)
          const hasProfile = !!person.profile_url
          const isSelected = selectedItem?.id === `person-${i}`

          return (
            <div
              key={`${person.profile_url ?? i}`}
              className={cn(
                'group flex gap-3 p-3 rounded-lg border transition-all cursor-pointer',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'hover:border-foreground/20'
              )}
              onClick={() => {
                if (isSelected) {
                  setSelectedItem(null)
                } else {
                  setSelectedItem({
                    id: `person-${i}`,
                    type: 'person',
                    title: name,
                    subtitle: person.headline,
                    url: person.profile_url,
                    data: {
                      headline: person.headline,
                      location: person.location
                    }
                  })
                }
              }}
            >
              {/* Avatar */}
              <div className="size-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                {initials}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {hasProfile ? (
                    <a
                      href={person.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline truncate"
                      onClick={e => e.stopPropagation()}
                    >
                      {name}
                    </a>
                  ) : (
                    <span className="text-sm font-medium truncate">{name}</span>
                  )}
                  {hasProfile && (
                    <a
                      href={person.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground/50 hover:text-foreground shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  {person.signals?.open_to_work && (
                    <span className="text-[10px] font-medium text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                      Open to work
                    </span>
                  )}
                </div>

                {person.headline && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {person.headline}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                  {person.location && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate max-w-[120px]">
                        {person.location}
                      </span>
                    </span>
                  )}
                  {distance && (
                    <span className="flex items-center gap-0.5">
                      <Users className="size-3 shrink-0" />
                      {distance}
                    </span>
                  )}
                  {(person.is_founder || person.is_cxo) && (
                    <span className="flex items-center gap-0.5 text-amber-600">
                      <Sparkles className="size-3 shrink-0" />
                      {person.is_founder ? 'Founder' : 'C-level'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
