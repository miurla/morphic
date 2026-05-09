'use client'

import { useState } from 'react'

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

type SmartMessageOutput = {
  message?: {
    text?: string
    subject?: string
    tone?: string
    purpose?: string
  }
  recipient?: {
    name?: string
    title?: string
    company?: string
    linkedin_url?: string
    profile_url?: string
  }
  personalization?: {
    hooks_used?: string[]
    approach_angle?: string
  }
  draft_message?: string
  cover_message?: string
}

function extractMessage(d: SmartMessageOutput): string {
  return d.message?.text ?? d.draft_message ?? d.cover_message ?? ''
}

function extractRecipientName(d: SmartMessageOutput): string {
  return d.recipient?.name ?? ''
}

function extractRecipientUrl(d: SmartMessageOutput): string {
  return d.recipient?.linkedin_url ?? d.recipient?.profile_url ?? ''
}

export function MelronMessageResult({ data }: { data: unknown }) {
  const d = (data ?? {}) as SmartMessageOutput
  const { sendMessage } = useChatContext()

  const [message, setMessage] = useState(extractMessage(d))
  const [editingMessage, setEditingMessage] = useState(false)

  const recipientName = extractRecipientName(d)
  const recipientUrl = extractRecipientUrl(d)
  const recipient = d.recipient
  const subject = d.message?.subject

  if (!message) {
    return (
      <div className="text-sm text-muted-foreground p-3">
        Message non disponible.
      </div>
    )
  }

  const messageLines = message
    .split(/\\n|\n/)
    .filter(l => l.trim().length > 0)

  const handleSend = () => {
    if (!recipientName) return
    sendMessage({
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `Envoyer ce message à ${recipientName}`
        }
      ]
    })
  }

  const handleSchedule = () => {
    if (!recipientName) return
    sendMessage({
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `Programmer l'envoi du message à ${recipientName} pour demain matin à l'heure optimale`
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
          text: 'Enregistrer ce brouillon'
        }
      ]
    })
  }

  return (
    <div className="space-y-4">
      {/* Recipient */}
      {recipient && (
        <div className="flex items-start gap-3 p-3 rounded-lg border">
          <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {recipientName || 'Destinataire'}
              </span>
              {recipientUrl && (
                <a
                  href={recipientUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            {recipient.title && (
              <div className="text-xs text-muted-foreground">
                {recipient.title}
                {recipient.company && ` · ${recipient.company}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subject */}
      {subject && (
        <div className="px-1">
          <div className="text-xs text-muted-foreground mb-0.5">Objet</div>
          <div className="text-sm font-medium">{subject}</div>
        </div>
      )}

      {/* Message */}
      {editingMessage ? (
        <div className="space-y-2">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={8}
            className="w-full text-sm leading-relaxed rounded-lg border bg-background p-3 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Escape') setEditingMessage(false)
            }}
          />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => {
                setMessage(extractMessage(d))
                setEditingMessage(false)
              }}
            >
              <X className="size-3" />
              Annuler
            </Button>
            <Button
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => setEditingMessage(false)}
            >
              <Check className="size-3" />
              OK
            </Button>
          </div>
        </div>
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
