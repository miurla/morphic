'use client'

import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  MapPin,
  Users
} from 'lucide-react'

import { useChatContext } from '@/lib/contexts/chat-context'
import { cn } from '@/lib/utils'

type Job = {
  job_id?: string
  title?: string
  company?: { name?: string; link?: string; logo?: string } | string
  company_url?: string
  location?: string
  salary?: string | null
  date?: string
  posted_at?: string
  posted_date?: string
  posted_days_ago?: number
  applicants_actual?: number | null
  applicants_estimated?: number | null
  applicants_source?: 'actual' | 'estimated'
  url?: string
  linkedin_url?: string
  match_score?: number
  match_reasons?: string[]
  competition_level?: 'low' | 'medium' | 'high' | 'very_high'
  easy_apply?: boolean
  red_flags?: string[]
  presence?: string
}

type SearchMeta = {
  total_raw_results?: number
  total_found?: number
  total_analyzed?: number
  rounds_needed?: number
  rounds_used?: number
  elapsed_seconds?: number
  filters_applied?: string[]
  geographic_coverage?: string
  summary?: string
}

type Briefing = {
  summary?: string
  market_insight?: string
  next_steps?: string[]
  next_actions?: string[]
  alternative_keywords?: string[]
  recommendations?: string[]
}

type SmartJobSearchOutput = {
  curated_jobs?: Job[]
  search_meta?: SearchMeta
  agent_briefing?: Briefing
}

function getCompanyName(c: Job['company']): string | undefined {
  if (!c) return undefined
  return typeof c === 'string' ? c : c.name
}

function getCompanyLogo(c: Job['company']): string | undefined {
  return typeof c === 'object' ? c?.logo : undefined
}

function formatApplicants(job: Job): string | null {
  const count = job.applicants_actual ?? job.applicants_estimated
  if (count == null) return null
  return `${count}`
}

function competitionStyle(level?: Job['competition_level']) {
  switch (level) {
    case 'low':
      return 'text-green-600 dark:text-green-400'
    case 'medium':
      return 'text-amber-600 dark:text-amber-400'
    case 'high':
    case 'very_high':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-muted-foreground'
  }
}

function formatPostedDate(job: Job): string | null {
  if (job.posted_days_ago != null) {
    if (job.posted_days_ago === 0) return "Aujourd'hui"
    if (job.posted_days_ago === 1) return 'Hier'
    return `${job.posted_days_ago}j`
  }
  return job.posted_at ?? job.posted_date ?? job.date ?? null
}

export function MelronJobSearchResult({ data }: { data: unknown }) {
  const d = (data ?? {}) as SmartJobSearchOutput
  const jobs = d.curated_jobs ?? []
  const meta = d.search_meta
  const briefing = d.agent_briefing
  const { selectedItem, setSelectedItem } = useChatContext()

  if (jobs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3">
        Aucune offre trouvée.
        {briefing?.alternative_keywords?.length ? (
          <div className="mt-2">
            Essaye :{' '}
            <span className="font-medium">
              {briefing.alternative_keywords.join(', ')}
            </span>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {meta && (
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 px-1">
          {meta.total_found != null && (
            <span>{meta.total_found} offres trouvées</span>
          )}
          {meta.total_analyzed != null && (
            <span>{meta.total_analyzed} analysées</span>
          )}
          {meta.elapsed_seconds != null && (
            <span>{meta.elapsed_seconds}s</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {jobs.map((job, i) => {
          const company = getCompanyName(job.company)
          const logo = getCompanyLogo(job.company)
          const applicants = formatApplicants(job)
          const posted = formatPostedDate(job)
          const jobUrl = job.url ?? job.linkedin_url
          const jobId = job.job_id ?? String(i)
          const isSelected = selectedItem?.id === jobId

          return (
            <div
              key={jobId}
              className={cn(
                'group relative flex gap-3 p-3 rounded-lg border transition-all cursor-pointer',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'hover:border-foreground/20'
              )}
              onClick={() => {
                if (isSelected) {
                  setSelectedItem(null)
                } else {
                  setSelectedItem({
                    id: jobId,
                    type: 'job',
                    title: job.title ?? 'Offre',
                    subtitle: company,
                    url: jobUrl,
                    data: {
                      company,
                      location: job.location,
                      job_id: job.job_id
                    }
                  })
                }
              }}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 size-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="size-3 text-primary-foreground" />
                </div>
              )}

              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt={company ?? ''}
                  className="h-9 w-9 rounded shrink-0 object-cover mt-0.5"
                />
              ) : (
                <div className="h-9 w-9 rounded shrink-0 bg-muted flex items-center justify-center mt-0.5">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <a
                  href={jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm leading-tight hover:underline line-clamp-2"
                  onClick={e => e.stopPropagation()}
                >
                  {job.title ?? 'Sans titre'}
                </a>
                {company && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {company}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                  {job.location && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[140px]">
                        {job.location}
                      </span>
                    </span>
                  )}
                  {posted && (
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {posted}
                    </span>
                  )}
                  {applicants && (
                    <span
                      className={cn(
                        'flex items-center gap-0.5 font-medium',
                        competitionStyle(job.competition_level)
                      )}
                    >
                      <Users className="h-3 w-3 shrink-0" />
                      {applicants}
                    </span>
                  )}
                  {job.easy_apply && (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      Easy Apply
                    </span>
                  )}
                </div>

                {job.red_flags && job.red_flags.length > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {job.red_flags.join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
