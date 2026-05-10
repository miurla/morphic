'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  Brain,
  Briefcase,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  User,
  Users,
  X,
  Zap
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from '../ui/button'
import { Input } from '../ui/input'

type Memory = {
  id: string
  category: string
  content: string
  confidence: number
  updatedAt: string
}

const CATEGORY_META: Record<
  string,
  { label: string; Icon: typeof Brain; color: string }
> = {
  identity: { label: 'Identité', Icon: User, color: 'text-blue-500 bg-blue-500/10' },
  business: { label: 'Business', Icon: Briefcase, color: 'text-emerald-500 bg-emerald-500/10' },
  icp: { label: 'Cibles', Icon: Target, color: 'text-purple-500 bg-purple-500/10' },
  positioning: { label: 'Positionnement', Icon: Sparkles, color: 'text-amber-500 bg-amber-500/10' },
  goals: { label: 'Objectifs', Icon: TrendingUp, color: 'text-green-500 bg-green-500/10' },
  relationships: { label: 'Relations', Icon: Users, color: 'text-pink-500 bg-pink-500/10' },
  preferences: { label: 'Préférences', Icon: Zap, color: 'text-orange-500 bg-orange-500/10' },
  constraints: { label: 'Contraintes', Icon: Shield, color: 'text-red-500 bg-red-500/10' }
}

function MemoryCard({
  memory,
  onDelete,
  onEdit
}: {
  memory: Memory
  onDelete: (id: string) => void
  onEdit: (id: string, content: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(memory.content)
  const meta = CATEGORY_META[memory.category]

  return (
    <div className="group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30">
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="text-sm h-8"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  onEdit(memory.id, draft)
                  setEditing(false)
                }
                if (e.key === 'Escape') {
                  setDraft(memory.content)
                  setEditing(false)
                }
              }}
            />
            <Button
              size="sm"
              className="h-8 px-2"
              onClick={() => {
                onEdit(memory.id, draft)
                setEditing(false)
              }}
            >
              OK
            </Button>
          </div>
        ) : (
          <p className="text-sm">{memory.content}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground">
            {memory.confidence}% confiance
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(!editing)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Edit3 className="size-3" />
        </button>
        <button
          onClick={() => onDelete(memory.id)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  )
}

export function MemoryDashboard() {
  const [grouped, setGrouped] = useState<Record<string, Memory[]>>({})
  const [loading, setLoading] = useState(true)
  const [deriving, setDeriving] = useState(false)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')

  const fetchMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/memory')
      const data = await res.json()
      setGrouped(data.grouped ?? {})
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  const handleDelete = async (id: string) => {
    await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id })
    })
    fetchMemories()
  }

  const handleEdit = async (id: string, content: string) => {
    await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, content })
    })
    fetchMemories()
  }

  const handleAdd = async (category: string) => {
    if (!newContent.trim()) return
    await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', category, content: newContent })
    })
    setNewContent('')
    setAddingTo(null)
    fetchMemories()
  }

  const handleDerive = async () => {
    setDeriving(true)
    try {
      const res = await fetch('/api/memory/derive', { method: 'POST' })
      const data = await res.json()
      if (data.operations > 0) fetchMemories()
    } catch {
    } finally {
      setDeriving(false)
    }
  }

  const totalMemories = Object.values(grouped).reduce(
    (sum, arr) => sum + arr.length,
    0
  )

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 space-y-1">
        <div className="flex items-center gap-2">
          <Brain className="size-6 text-primary" />
          <h1 className="text-2xl font-bold">Mémoire</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Ce que Melron sait de toi. Ces faits personnalisent tes
          recherches et messages.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3">
        <span className="text-sm text-muted-foreground">
          {totalMemories} fait{totalMemories !== 1 ? 's' : ''} mémorisé
          {totalMemories !== 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleDerive}
          disabled={deriving}
        >
          {deriving ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          {deriving ? 'Extraction...' : 'Extraire des conversations'}
        </Button>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
        {totalMemories === 0 && !deriving && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
              <Brain className="size-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Aucun souvenir</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Clique sur &quot;Extraire des conversations&quot; pour que
                Melron apprenne de tes échanges, ou ajoute des faits
                manuellement.
              </p>
            </div>
          </div>
        )}

        {Object.entries(CATEGORY_META).map(([category, meta]) => {
          const facts = grouped[category] ?? []
          const Icon = meta.Icon

          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn(
                    'size-7 rounded-lg flex items-center justify-center',
                    meta.color
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <h3 className="text-sm font-semibold">{meta.label}</h3>
                <span className="text-xs text-muted-foreground">
                  {facts.length}
                </span>
                <button
                  onClick={() =>
                    setAddingTo(addingTo === category ? null : category)
                  }
                  className="ml-auto p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>

              {addingTo === category && (
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                    placeholder={`Ajouter un fait (${meta.label.toLowerCase()})...`}
                    className="text-sm h-8"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAdd(category)
                      if (e.key === 'Escape') {
                        setAddingTo(null)
                        setNewContent('')
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => handleAdd(category)}
                    disabled={!newContent.trim()}
                  >
                    Ajouter
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => {
                      setAddingTo(null)
                      setNewContent('')
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}

              {facts.length > 0 ? (
                <div className="space-y-1.5">
                  {facts.map(m => (
                    <MemoryCard
                      key={m.id}
                      memory={m}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              ) : (
                addingTo !== category && (
                  <p className="text-xs text-muted-foreground pl-9">
                    Aucun fait
                  </p>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
