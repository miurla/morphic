'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import {
  Activity,
  ArrowLeft,
  Bookmark,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Eye,
  Heart,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Send,
  Trash2,
  X
} from 'lucide-react'

import {
  deleteHeartbeat,
  getHeartbeats,
  type Heartbeat,
  type HeartbeatRun,
  toggleHeartbeat
} from '@/lib/heartbeat/store'
import { cn } from '@/lib/utils'

import { Button } from '../ui/button'

// ── Helpers ──────────────────────────────────────────

function formatFrequency(hb: Heartbeat): string {
  switch (hb.frequency) {
    case 'daily':
      return 'Quotidien'
    case 'weekly':
      return 'Hebdomadaire'
    case 'custom':
      return hb.cronExpression ?? 'Personnalisé'
    default:
      return hb.frequency
  }
}

function channelMeta(channel: Heartbeat['channel']) {
  return channel === 'email'
    ? { label: 'Email', Icon: Mail }
    : { label: 'WhatsApp', Icon: MessageCircle }
}

function timeAgo(ts?: number): string {
  if (!ts) return 'Jamais'
  const diff = Math.floor((Date.now() - ts) / 60000)
  if (diff < 1) return "À l'instant"
  if (diff < 60) return `Il y a ${diff}min`
  const hours = Math.floor(diff / 60)
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `Il y a ${days}j`
}

function formatRunDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function statusBadge(status: string) {
  switch (status) {
    case 'new':
      return { label: 'Nouveau', class: 'bg-blue-500/10 text-blue-600' }
    case 'saved':
      return { label: 'Sauvegardé', class: 'bg-green-500/10 text-green-600' }
    case 'applied':
      return { label: 'Postulé', class: 'bg-purple-500/10 text-purple-600' }
    case 'ignored':
      return { label: 'Ignoré', class: 'bg-muted text-muted-foreground' }
    default:
      return { label: status, class: 'bg-muted text-muted-foreground' }
  }
}

// ── Heartbeat Detail View ────────────────────────────

function HeartbeatDetail({
  hb,
  onBack,
  onRefresh
}: {
  hb: Heartbeat
  onBack: () => void
  onRefresh: () => void
}) {
  const channel = channelMeta(hb.channel)
  const isActive = hb.status === 'active'
  const runs = hb.runs ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b space-y-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Tous les heartbeats
        </button>

        <div className="flex items-start gap-4">
          <div
            className={cn(
              'size-12 rounded-xl flex items-center justify-center shrink-0',
              isActive
                ? 'bg-green-500/10 text-green-500'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <Activity
              className={cn('size-6', isActive && 'animate-pulse')}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold line-clamp-1">{hb.chatTitle}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{hb.query}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full',
                  isActive
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    isActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
                  )}
                />
                {isActive ? 'Actif' : 'En pause'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatFrequency(hb)}
              </span>
              <span className="flex items-center gap-1">
                <channel.Icon className="size-3" />
                {channel.label}
              </span>
              <span>{runs.length} envoi{runs.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                toggleHeartbeat(hb.id)
                onRefresh()
              }}
            >
              {isActive ? (
                <>
                  <Pause className="size-3" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="size-3" />
                  Reprendre
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => {
                deleteHeartbeat(hb.id)
                onBack()
              }}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Run history */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Historique des envois
        </h2>

        {runs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">
            Aucun envoi pour le moment.
          </div>
        ) : (
          <div className="space-y-6">
            {runs.map(run => (
              <RunCard key={run.id} run={run} heartbeatId={hb.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Run Card ─────────────────────────────────────────

function RunCard({
  run,
  heartbeatId
}: {
  run: HeartbeatRun
  heartbeatId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const newCount = run.results.filter(r => r.status === 'new').length
  const viewUrl = `/heartbeat/view/${run.viewToken}`

  return (
    <div className="rounded-xl border bg-background">
      {/* Run header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-t-xl"
      >
        <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Send className="size-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">
            {formatRunDate(run.runAt)}
          </div>
          <div className="text-xs text-muted-foreground">
            {run.resultsCount} résultat{run.resultsCount !== 1 ? 's' : ''}
            {newCount > 0 && (
              <span className="ml-1.5 text-blue-600 font-medium">
                · {newCount} nouveau{newCount !== 1 ? 'x' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={viewUrl}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="size-3" />
            Lien de validation
          </Link>
          <svg
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              expanded && 'rotate-180'
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Results */}
      {expanded && (
        <div className="border-t divide-y">
          {run.results.map(result => {
            const badge = statusBadge(result.status)
            return (
              <div
                key={result.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium line-clamp-1">
                    {result.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {result.company}
                    {result.location && ` · ${result.location}`}
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0',
                    badge.class
                  )}
                >
                  {badge.label}
                </span>
                {result.url && (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Heartbeat List Card ──────────────────────────────

function HeartbeatListCard({
  hb,
  onSelect,
  onRefresh
}: {
  hb: Heartbeat
  onSelect: () => void
  onRefresh: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const channel = channelMeta(hb.channel)
  const isActive = hb.status === 'active'
  const totalResults =
    hb.runs?.reduce((sum, r) => sum + r.resultsCount, 0) ?? 0

  return (
    <div
      className="rounded-xl border bg-background p-5 space-y-4 relative group cursor-pointer hover:shadow-md transition-shadow"
      onClick={onSelect}
    >
      {/* Menu */}
      <div className="absolute top-4 right-4 z-10">
        <button
          className={cn(
            'p-1 rounded-md transition-colors',
            menuOpen
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground'
          )}
          onClick={e => {
            e.stopPropagation()
            setMenuOpen(!menuOpen)
          }}
        >
          <MoreHorizontal className="size-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-40 rounded-lg border bg-background shadow-lg py-1">
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
              onClick={e => {
                e.stopPropagation()
                toggleHeartbeat(hb.id)
                setMenuOpen(false)
                onRefresh()
              }}
            >
              {isActive ? <Pause className="size-3" /> : <Play className="size-3" />}
              {isActive ? 'Mettre en pause' : 'Reprendre'}
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-muted transition-colors"
              onClick={e => {
                e.stopPropagation()
                deleteHeartbeat(hb.id)
                setMenuOpen(false)
                onRefresh()
              }}
            >
              <Trash2 className="size-3" />
              Supprimer
            </button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start gap-3 pr-8">
        <div
          className={cn(
            'size-10 rounded-xl flex items-center justify-center shrink-0',
            isActive
              ? 'bg-green-500/10 text-green-500'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <Activity className={cn('size-5', isActive && 'animate-pulse')} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold line-clamp-1">{hb.chatTitle}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {hb.query}
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
            isActive
              ? 'bg-green-500/10 text-green-600'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              isActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
            )}
          />
          {isActive ? 'Actif' : 'En pause'}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {formatFrequency(hb)}
        </span>
        <span className="flex items-center gap-1">
          <channel.Icon className="size-3" />
          {channel.label}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="size-3" />
          {timeAgo(hb.lastRunAt)}
        </span>
      </div>

      {/* Stats footer */}
      <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
        <span>{hb.runs?.length ?? 0} envois</span>
        <span>{totalResults} résultats trouvés</span>
        <span className="ml-auto flex items-center gap-1 text-primary">
          <Eye className="size-3" />
          Détails
        </span>
      </div>
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────

export function HeartbeatDashboard() {
  const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = () => setHeartbeats(getHeartbeats())

  useEffect(() => {
    refresh()
    setLoaded(true)
    const handler = () => refresh()
    window.addEventListener('heartbeat-updated', handler)
    return () => window.removeEventListener('heartbeat-updated', handler)
  }, [])

  if (!loaded) return null

  const selected = selectedId
    ? heartbeats.find(h => h.id === selectedId)
    : null

  if (selected) {
    return (
      <HeartbeatDetail
        hb={selected}
        onBack={() => setSelectedId(null)}
        onRefresh={refresh}
      />
    )
  }

  const active = heartbeats.filter(h => h.status === 'active')
  const paused = heartbeats.filter(h => h.status === 'paused')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 space-y-1">
        <div className="flex items-center gap-2">
          <Heart className="size-6 text-red-500" />
          <h1 className="text-2xl font-bold">Heartbeat</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Vos recherches automatiques qui tournent en arrière-plan et vous
          notifient des nouveaux résultats.
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 px-6 py-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green-500 animate-pulse" />
          {active.length} actif{active.length !== 1 ? 's' : ''}
        </span>
        {paused.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground" />
            {paused.length} en pause
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {heartbeats.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
              <Activity className="size-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Aucun heartbeat</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Ouvrez le menu d&apos;une conversation dans la sidebar et
                cliquez &quot;Créer un Heartbeat&quot; pour lancer une recherche
                récurrente.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {heartbeats.map(hb => (
              <HeartbeatListCard
                key={hb.id}
                hb={hb}
                onSelect={() => setSelectedId(hb.id)}
                onRefresh={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
