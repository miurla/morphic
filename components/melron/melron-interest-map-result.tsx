'use client'

import {
  Brain,
  Clock,
  Lightbulb,
  MessageCircle,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  User
} from 'lucide-react'

import { useChatContext } from '@/lib/contexts/chat-context'
import { cn } from '@/lib/utils'

import { Button } from '../ui/button'

type Subject = {
  topic?: string
  score?: number
  evidence?: string
}

type BehavioralSignals = {
  posting_frequency?: string
  tone?: string
  engagement_style?: string
  active_hours_hint?: string
  network_focus?: string
}

type BestContactApproach = {
  channel?: string
  timing?: string
  tone_recommendation?: string
  do_not?: string[]
}

type ConversationHook = {
  hook?: string
  based_on?: string
  effectiveness?: number
}

type InterestMap = {
  top_subjects?: Subject[]
  behavioral_signals?: BehavioralSignals
  best_contact_approach?: BestContactApproach
  conversation_hooks?: ConversationHook[]
}

type SmartInterestMapOutput = {
  interest_map?: InterestMap
  persona_summary?: string
  confidence_score?: number
  person?: {
    name?: string
    headline?: string
    location?: string
    profile_url?: string
  }
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
        {pct}%
      </span>
    </div>
  )
}

export function MelronInterestMapResult({ data }: { data: unknown }) {
  const d = (data ?? {}) as SmartInterestMapOutput
  const map = d.interest_map
  const { sendMessage } = useChatContext()

  if (!map) {
    return (
      <div className="text-sm text-muted-foreground p-3">
        Analyse non disponible.
      </div>
    )
  }

  const subjects = map.top_subjects ?? []
  const signals = map.behavioral_signals
  const approach = map.best_contact_approach
  const hooks = map.conversation_hooks ?? []
  const personName = d.person?.name

  const handleDraftMessage = () => {
    sendMessage({
      role: 'user',
      parts: [
        {
          type: 'text',
          text: personName
            ? `Rédiger un message personnalisé pour ${personName}`
            : 'Rédiger un message personnalisé basé sur cette analyse'
        }
      ]
    })
  }

  return (
    <div className="space-y-4">
      {/* Persona summary */}
      {d.persona_summary && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <Brain className="size-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm leading-relaxed">{d.persona_summary}</p>
        </div>
      )}

      {/* Top interests */}
      {subjects.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3" />
            Centres d&apos;intérêt
          </div>
          <div className="space-y-2">
            {subjects.map((s, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.topic}</span>
                </div>
                {s.score != null && <ScoreBar score={s.score} />}
                {s.evidence && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {s.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Behavioral signals */}
      {signals && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <TrendingUp className="size-3" />
            Signaux comportementaux
          </div>
          <div className="grid grid-cols-2 gap-2">
            {signals.posting_frequency && (
              <div className="rounded-lg border p-2.5">
                <div className="text-[10px] text-muted-foreground mb-0.5">Fréquence</div>
                <div className="text-xs font-medium capitalize">{signals.posting_frequency}</div>
              </div>
            )}
            {signals.tone && (
              <div className="rounded-lg border p-2.5">
                <div className="text-[10px] text-muted-foreground mb-0.5">Ton</div>
                <div className="text-xs font-medium capitalize">{signals.tone}</div>
              </div>
            )}
            {signals.engagement_style && (
              <div className="rounded-lg border p-2.5">
                <div className="text-[10px] text-muted-foreground mb-0.5">Style</div>
                <div className="text-xs font-medium capitalize">{signals.engagement_style}</div>
              </div>
            )}
            {signals.active_hours_hint && (
              <div className="rounded-lg border p-2.5">
                <div className="text-[10px] text-muted-foreground mb-0.5">Actif</div>
                <div className="text-xs font-medium">{signals.active_hours_hint}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conversation hooks */}
      {hooks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lightbulb className="size-3" />
            Accroches suggérées
          </div>
          <div className="space-y-2">
            {hooks.map((h, i) => (
              <div key={i} className="rounded-lg border p-3">
                <p className="text-sm leading-relaxed italic">
                  &ldquo;{h.hook}&rdquo;
                </p>
                {h.based_on && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Basé sur : {h.based_on}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best contact approach */}
      {approach && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Target className="size-3" />
            Meilleure approche
          </div>
          <div className="rounded-lg border p-3 space-y-2 text-xs">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {approach.channel && (
                <span className="flex items-center gap-1">
                  <MessageCircle className="size-3" />
                  {approach.channel}
                </span>
              )}
              {approach.timing && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {approach.timing}
                </span>
              )}
            </div>
            {approach.tone_recommendation && (
              <p className="text-muted-foreground">
                Ton : {approach.tone_recommendation}
              </p>
            )}
            {approach.do_not && approach.do_not.length > 0 && (
              <p className="text-red-500/80">
                À éviter : {approach.do_not.join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" className="gap-1.5 text-xs" onClick={handleDraftMessage}>
          <Send className="size-3" />
          Rédiger un message personnalisé
        </Button>
      </div>
    </div>
  )
}
