'use client'

import { useRef, useState } from 'react'

import {
  Bookmark,
  Check,
  Clock,
  ExternalLink,
  Pencil,
  Send,
  User,
  X
} from 'lucide-react'

import { useChatContext } from '@/lib/contexts/chat-context'

import { Button } from '../ui/button'

type Recruiter = {
  name?: string
  title?: string
  company?: string
  linkedin_url?: string
  profile_url?: string
}

type Application = {
  approach_angle?: string
  cover_message?: string
  subject_line?: string
  apply_url?: string
  easy_apply?: boolean
  send_status?: string
}

type AgentBriefing = {
  competition_analysis?: string
  timing_advice?: string
  next_steps?: string[]
}

type BoardUpdate = {
  company?: string
  title?: string
  status?: string
}

type SmartApplyOutput = {
  recruiter?: Recruiter
  application?: Application
  agent_briefing?: AgentBriefing
  board_update?: BoardUpdate
}

function EditableField({
  value,
  onSave,
  multiline = false
}: {
  value: string
  onSave: (v: string) => void
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  const handleEdit = () => {
    setDraft(value)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleSave = () => {
    onSave(draft)
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={handleEdit}
        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title="Modifier"
      >
        <Pencil className="size-3" />
      </button>
    )
  }

  return (
    <div className="flex-1 space-y-2">
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={8}
          className="w-full text-sm leading-relaxed rounded-lg border bg-background p-3 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={e => {
            if (e.key === 'Escape') handleCancel()
          }}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="w-full text-sm font-medium rounded border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
        />
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={handleCancel}
        >
          <X className="size-3" />
          Annuler
        </Button>
        <Button
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={handleSave}
        >
          <Check className="size-3" />
          OK
        </Button>
      </div>
    </div>
  )
}

export function MelronApplyResult({ data }: { data: unknown }) {
  const d = (data ?? {}) as SmartApplyOutput
  const recruiter = d.recruiter
  const app = d.application
  const briefing = d.agent_briefing
  const { sendMessage } = useChatContext()

  const [subject, setSubject] = useState(app?.subject_line ?? '')
  const [message, setMessage] = useState(app?.cover_message ?? '')
  const [editingSubject, setEditingSubject] = useState(false)
  const [editingMessage, setEditingMessage] = useState(false)

  if (!app?.cover_message) {
    return (
      <div className="text-sm text-muted-foreground p-3">
        Impossible de préparer la candidature.
      </div>
    )
  }

  const recruiterUrl = recruiter?.linkedin_url ?? recruiter?.profile_url
  const messageLines = message
    .split(/\\n|\n/)
    .filter(l => l.trim().length > 0)

  const handleSend = () => {
    if (!recruiter?.name || !message) return
    sendMessage({
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `Envoyer le message de candidature à ${recruiter.name}`
        }
      ]
    })
  }

  const handleSchedule = () => {
    if (!recruiter?.name) return
    sendMessage({
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `Programmer l'envoi du message à ${recruiter.name} pour demain matin à l'heure optimale`
        }
      ]
    })
  }

  const handleSave = () => {
    sendMessage({
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'Enregistrer cette candidature sur mon board'
        }
      ]
    })
  }

  return (
    <div className="space-y-4">
      {/* Recruiter */}
      {recruiter && (
        <div className="flex items-start gap-3 p-3 rounded-lg border">
          <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {recruiter.name ?? 'Recruteur'}
              </span>
              {recruiterUrl && (
                <a
                  href={recruiterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            {recruiter.title && (
              <div className="text-xs text-muted-foreground">
                {recruiter.title}
                {recruiter.company && ` · ${recruiter.company}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subject */}
      {subject && (
        <div className="px-1">
          <div className="text-xs text-muted-foreground mb-0.5">Objet</div>
          {editingSubject ? (
            <EditableField
              value={subject}
              onSave={v => {
                setSubject(v)
                setEditingSubject(false)
              }}
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium flex-1">{subject}</div>
              <button
                type="button"
                onClick={() => setEditingSubject(true)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Modifier l'objet"
              >
                <Pencil className="size-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {editingMessage ? (
        <EditableField
          value={message}
          multiline
          onSave={v => {
            setMessage(v)
            setEditingMessage(false)
          }}
        />
      ) : (
        <div className="relative group rounded-lg border p-4">
          <div className="space-y-2">
            {messageLines.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed">
                {line}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEditingMessage(true)}
            className="absolute top-2 right-2 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
            title="Modifier le message"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
      )}

      {/* Timing advice */}
      {briefing?.timing_advice && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
          <Clock className="size-3 mt-0.5 shrink-0" />
          <span>{briefing.timing_advice}</span>
        </div>
      )}

      {/* CTA buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleSave}
        >
          <Bookmark className="size-3" />
          Enregistrer
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleSchedule}
        >
          <Clock className="size-3" />
          Envoyer demain
        </Button>
        <Button
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleSend}
        >
          <Send className="size-3" />
          Envoyer
        </Button>
      </div>
    </div>
  )
}
