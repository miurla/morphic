'use client'

import { useEffect, useState } from 'react'

import {
  Activity,
  Bookmark,
  Check,
  Clock,
  ExternalLink,
  MapPin,
  Pause,
  Send,
  X
} from 'lucide-react'

import {
  getHeartbeats,
  type Heartbeat,
  type HeartbeatRun,
  type HeartbeatRunResult,
  toggleHeartbeat,
  updateRunResultStatus
} from '@/lib/heartbeat/store'
import { cn } from '@/lib/utils'

import { Button } from '../ui/button'

function findByToken(token: string): {
  heartbeat: Heartbeat
  run: HeartbeatRun
} | null {
  const all = getHeartbeats()
  for (const hb of all) {
    for (const run of hb.runs ?? []) {
      if (run.viewToken === token) return { heartbeat: hb, run }
    }
  }
  return null
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function statusStyle(status: HeartbeatRunResult['status']) {
  switch (status) {
    case 'saved':
      return 'border-green-500/30 bg-green-500/5'
    case 'applied':
      return 'border-purple-500/30 bg-purple-500/5'
    case 'ignored':
      return 'opacity-50'
    default:
      return ''
  }
}

function ResultCard({
  result,
  heartbeatId,
  runId
}: {
  result: HeartbeatRunResult
  heartbeatId: string
  runId: string
}) {
  const [status, setStatus] = useState(result.status)

  const update = (newStatus: HeartbeatRunResult['status']) => {
    setStatus(newStatus)
    updateRunResultStatus(heartbeatId, runId, result.id, newStatus)
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-background p-5 transition-all',
        statusStyle(status)
      )}
    >
      <div className="flex items-start gap-4">
        <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
          {result.company?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold line-clamp-2">{result.title}</h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{result.company}</span>
            {result.location && (
              <span className="flex items-center gap-0.5">
                <MapPin className="size-3" />
                {result.location}
              </span>
            )}
          </div>
        </div>
        {result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>

      {/* Actions */}
      {status === 'new' ? (
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs flex-1"
            onClick={() => update('saved')}
          >
            <Bookmark className="size-3" />
            Sauvegarder
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs flex-1"
            onClick={() => update('applied')}
          >
            <Send className="size-3" />
            Postuler
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={() => update('ignored')}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-4 text-xs">
          {status === 'saved' && (
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <Bookmark className="size-3" />
              Sauvegardé
            </span>
          )}
          {status === 'applied' && (
            <span className="flex items-center gap-1 text-purple-600 font-medium">
              <Check className="size-3" />
              Candidature lancée
            </span>
          )}
          {status === 'ignored' && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <X className="size-3" />
              Ignoré
            </span>
          )}
          <button
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            onClick={() => update('new')}
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  )
}

export function HeartbeatViewPage({ token }: { token: string }) {
  const [data, setData] = useState<{
    heartbeat: Heartbeat
    run: HeartbeatRun
  } | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setData(findByToken(token))
    setLoaded(true)
  }, [token])

  if (!loaded) return null

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Activity className="size-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold">Lien expiré ou invalide</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Ce lien de validation n&apos;est plus disponible. Il a peut-être
            expiré ou été supprimé.
          </p>
        </div>
      </div>
    )
  }

  const { heartbeat, run } = data
  const newCount = run.results.filter(r => r.status === 'new').length
  const isActive = heartbeat.status === 'active'

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <div className="border-b bg-background">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Activity
            className={cn(
              'size-5',
              isActive ? 'text-green-500 animate-pulse' : 'text-muted-foreground'
            )}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">
              {heartbeat.chatTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              {formatDate(run.runAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                toggleHeartbeat(heartbeat.id)
                setData(findByToken(token))
              }}
            >
              {isActive ? (
                <>
                  <Pause className="size-3" />
                  Mettre en pause
                </>
              ) : (
                <>
                  <Clock className="size-3" />
                  Reprendre
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Summary */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">
            {run.resultsCount} résultat{run.resultsCount !== 1 ? 's' : ''}{' '}
            trouvé{run.resultsCount !== 1 ? 's' : ''}
          </h2>
          <p className="text-muted-foreground">
            {newCount > 0
              ? `${newCount} nouveau${newCount !== 1 ? 'x' : ''} à traiter`
              : 'Tous les résultats ont été traités'}
          </p>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {run.results.map(result => (
            <ResultCard
              key={result.id}
              result={result}
              heartbeatId={heartbeat.id}
              runId={run.id}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="text-center pt-6 border-t">
          <p className="text-xs text-muted-foreground">
            Propulsé par Melron · Ce lien est personnel et expire
            automatiquement.
          </p>
        </div>
      </div>
    </div>
  )
}
