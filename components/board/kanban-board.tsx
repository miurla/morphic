'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  Ban,
  Bookmark,
  Bot,
  Calendar,
  Clock,
  ExternalLink,
  Link2,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  User
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from '../ui/button'

// ── Types ──────────────────────────────────────────────

type Card = {
  _id: string
  title: string
  company?: string
  jobUrl?: string
  priority?: 'low' | 'medium' | 'high'
  appliedAt?: number
  columnId: string
  createdBy?: string
  aiNote?: string
}

type Column = {
  _id: string
  name: string
}

type BoardData = {
  board?: { name?: string }
  columns?: Column[]
  cards?: Card[]
}

type DisplayColumn = {
  id: string
  name: string
  icon: typeof Bookmark
  color: string
  mcpColumnIds: string[]
}

// ── Helpers ────────────────────────────────────────────

function buildDisplayColumns(mcpColumns: Column[]): DisplayColumn[] {
  const byName: Record<string, string> = {}
  for (const col of mcpColumns) byName[col.name] = col._id

  return [
    {
      id: 'saved',
      name: 'Enregistré',
      icon: Bookmark,
      color: 'text-blue-500',
      mcpColumnIds: [byName['À postuler']].filter(Boolean)
    },
    {
      id: 'planned',
      name: 'Planifié',
      icon: Clock,
      color: 'text-amber-500',
      mcpColumnIds: [byName['Applied']].filter(Boolean)
    },
    {
      id: 'sent',
      name: 'Envoyé',
      icon: Send,
      color: 'text-green-500',
      mcpColumnIds: [byName['Interview'], byName['Offer']].filter(Boolean)
    },
    {
      id: 'cancelled',
      name: 'Annulé',
      icon: Ban,
      color: 'text-muted-foreground',
      mcpColumnIds: [byName['Rejected'], byName['Archived']].filter(Boolean)
    }
  ]
}

function timeAgo(ts?: number): string | null {
  if (!ts) return null
  const diff = Math.floor((Date.now() - ts) / 86400000)
  if (diff === 0) return "Enregistré aujourd'hui"
  if (diff === 1) return 'Enregistré hier'
  return `Enregistré il y a ${diff} jours`
}

function companyInitials(name?: string): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

function getColumnLabel(columnId: string, displayColumns: DisplayColumn[]): string {
  return displayColumns.find(c => c.mcpColumnIds.includes(columnId))?.name ?? ''
}

// ── Card Detail Modal ──────────────────────────────────

function CardDetailModal({
  card,
  columnLabel,
  onClose
}: {
  card: Card
  columnLabel: string
  onClose: () => void
}) {
  const ago = timeAgo(card.appliedAt)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[80%] h-[80%] bg-background rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center gap-4 px-8 py-6 border-b">
          <div className="size-12 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0">
            {companyInitials(card.company)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold line-clamp-1">
              {card.title || 'Sans titre'}
            </h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {card.company && <span>{card.company}</span>}
              {columnLabel && (
                <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                  {columnLabel}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none px-2"
          >
            &times;
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {ago && (
              <span className="flex items-center gap-1.5">
                <Calendar className="size-4" />
                {ago}
              </span>
            )}
            {card.priority && (
              <span className="flex items-center gap-1.5">
                Priorité : <span className="font-medium text-foreground capitalize">{card.priority}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              {card.createdBy ? (
                <>
                  <User className="size-3.5" />
                  Créé par {card.createdBy}
                </>
              ) : (
                <>
                  <Bot className="size-3.5" />
                  Créé par melron
                </>
              )}
            </span>
          </div>

          {/* AI Note */}
          {card.aiNote && (
            <div className="rounded-lg bg-muted/50 border p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                <Bot className="size-3.5" />
                Note de l&apos;IA
              </div>
              <p className="text-sm leading-relaxed">{card.aiNote}</p>
            </div>
          )}

          {/* Job URL */}
          {card.jobUrl && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                Lien de l&apos;offre
              </div>
              <a
                href={card.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" />
                {card.jobUrl}
              </a>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex items-center gap-3 px-8 py-4 border-t">
          {card.jobUrl && (
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href={card.jobUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                Voir l&apos;offre
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 className="size-3.5" />
            Supprimer
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Kanban Card ────────────────────────────────────────

function KanbanCard({
  card,
  columnLabel,
  displayColumns,
  onDragStart,
  onClick,
  onDelete
}: {
  card: Card
  columnLabel: string
  displayColumns: DisplayColumn[]
  onDragStart: (e: React.DragEvent, cardId: string) => void
  onClick: () => void
  onDelete: (cardId: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ago = timeAgo(card.appliedAt)
  const aiNote =
    card.aiNote ?? 'Candidature enregistrée via la recherche LinkedIn.'

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, card._id)}
      onClick={onClick}
      className="group relative rounded-xl border bg-background shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing flex flex-col"
    >
      {/* 3-dot menu */}
      <div className="absolute top-3 right-3 z-10">
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
          <div className="absolute right-0 mt-1 w-36 rounded-lg border bg-background shadow-lg py-1">
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-muted transition-colors"
              onClick={e => {
                e.stopPropagation()
                setMenuOpen(false)
                onDelete(card._id)
              }}
            >
              <Trash2 className="size-3" />
              Supprimer
            </button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 pr-10">
        <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
          {companyInitials(card.company)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight line-clamp-1">
            {card.title || 'Sans titre'}
          </h3>
          {card.company && (
            <p className="text-xs text-muted-foreground truncate">
              {card.company}
            </p>
          )}
        </div>
      </div>

      {/* AI note */}
      <div className="px-4 py-2">
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {aiNote}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 pb-3 pt-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {ago && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {ago}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {card.createdBy ? (
            <User className="size-3" />
          ) : (
            <Bot className="size-3" />
          )}
          <span className="text-[10px]">
            {card.createdBy ?? 'melron'}
          </span>
        </div>
      </div>

      {/* CTA footer */}
      <div className="flex items-center border-t px-3 py-2 gap-1">
        {card.jobUrl && (
          <a
            href={card.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
            onClick={e => e.stopPropagation()}
          >
            <Link2 className="size-3" />
            Offre
          </a>
        )}
        <button
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted ml-auto"
          onClick={e => {
            e.stopPropagation()
            onClick()
          }}
        >
          Détails
        </button>
      </div>
    </div>
  )
}

// ── Kanban Column ──────────────────────────────────────

function KanbanColumn({
  column,
  cards,
  displayColumns,
  onDragStart,
  onDrop,
  dragOverColumn,
  onDragOver,
  onDragLeave,
  onCardClick,
  onDeleteCard
}: {
  column: DisplayColumn
  cards: Card[]
  displayColumns: DisplayColumn[]
  onDragStart: (e: React.DragEvent, cardId: string) => void
  onDrop: (e: React.DragEvent, columnId: string) => void
  dragOverColumn: string | null
  onDragOver: (e: React.DragEvent, columnId: string) => void
  onDragLeave: () => void
  onCardClick: (card: Card) => void
  onDeleteCard: (cardId: string) => void
}) {
  const Icon = column.icon
  const isOver = dragOverColumn === column.id

  return (
    <div
      className={cn(
        'flex flex-col min-w-[280px] flex-1 rounded-xl bg-muted/30 transition-colors',
        isOver && 'bg-accent/50 ring-2 ring-primary/20'
      )}
      onDragOver={e => onDragOver(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, column.id)}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <Icon className={cn('size-4', column.color)} />
        <span className="text-sm font-medium">{column.name}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-background border rounded-full px-2 py-0.5 tabular-nums">
          {cards.length}
        </span>
      </div>
      <div className="flex-1 px-3 pb-3 space-y-2.5 overflow-y-auto max-h-[calc(100vh-240px)]">
        {cards.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-10 rounded-xl border border-dashed bg-background/50">
            Aucune carte
          </div>
        )}
        {cards.map(card => (
          <KanbanCard
            key={card._id}
            card={card}
            columnLabel={column.name}
            displayColumns={displayColumns}
            onDragStart={onDragStart}
            onClick={() => onCardClick(card)}
            onDelete={onDeleteCard}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main Board ─────────────────────────────────────────

export function KanbanBoard() {
  const [data, setData] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const dragCardId = useRef<string | null>(null)
  const displayColumnsRef = useRef<DisplayColumn[]>([])

  const fetchBoard = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/board')
      if (!res.ok) throw new Error('Failed to load board')
      const json = await res.json()
      setData(json)
      displayColumnsRef.current = buildDisplayColumns(json.columns ?? [])
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  const displayColumns = displayColumnsRef.current

  const handleDragStart = (_e: React.DragEvent, cardId: string) => {
    dragCardId.current = cardId
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDragOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, displayColId: string) => {
    e.preventDefault()
    setDragOverColumn(null)
    const cardId = dragCardId.current
    if (!cardId || !data) return

    const targetCol = displayColumns.find(c => c.id === displayColId)
    if (!targetCol || targetCol.mcpColumnIds.length === 0) return

    const targetMcpColumnId = targetCol.mcpColumnIds[0]
    const card = data.cards?.find(c => c._id === cardId)
    if (!card || card.columnId === targetMcpColumnId) return

    setData(prev => {
      if (!prev?.cards) return prev
      return {
        ...prev,
        cards: prev.cards.map(c =>
          c._id === cardId ? { ...c, columnId: targetMcpColumnId } : c
        )
      }
    })

    try {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move_card',
          cardId,
          columnId: targetMcpColumnId
        })
      })
    } catch {
      fetchBoard()
    }
  }

  const handleDeleteCard = (cardId: string) => {
    setData(prev => {
      if (!prev?.cards) return prev
      return { ...prev, cards: prev.cards.filter(c => c._id !== cardId) }
    })
    // TODO: call MCP delete when available
  }

  const getCardsForColumn = (col: DisplayColumn) => {
    if (!data?.cards) return []
    let cards = data.cards.filter(c => col.mcpColumnIds.includes(c.columnId))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      cards = cards.filter(
        c =>
          c.title?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q)
      )
    }
    return cards
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-sm text-destructive">
          {error ?? 'Board non disponible'}
        </p>
        <button
          onClick={fetchBoard}
          className="text-sm text-primary hover:underline"
        >
          Réessayer
        </button>
      </div>
    )
  }

  const totalCards = data.cards?.length ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 pt-6 pb-2 space-y-1">
        <h1 className="text-2xl font-bold">
          {data.board?.name ?? 'Mon board'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Suivez vos candidatures et leur avancement en un coup d&apos;oeil.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher une candidature..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {totalCards} candidature{totalCards !== 1 ? 's' : ''}
        </span>
        <button
          onClick={fetchBoard}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="size-3" />
          Actualiser
        </button>
        <Button size="sm" className="gap-1.5 ml-auto">
          <Plus className="size-3.5" />
          Ajouter
        </Button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto px-4 pb-4">
        <div className="flex gap-3 h-full">
          {displayColumns.map(col => (
            <KanbanColumn
              key={col.id}
              column={col}
              cards={getCardsForColumn(col)}
              displayColumns={displayColumns}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              dragOverColumn={dragOverColumn}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onCardClick={setSelectedCard}
              onDeleteCard={handleDeleteCard}
            />
          ))}
        </div>
      </div>

      {/* Detail modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          columnLabel={getColumnLabel(selectedCard.columnId, displayColumns)}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  )
}
