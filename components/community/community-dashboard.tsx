'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Filter,
  Search,
  Sparkles,
  X
} from 'lucide-react'

import promptsData from '@/lib/community/prompts-data.json'
import {
  CATEGORIES,
  CATEGORY_ICONS,
  LEVEL_COLORS,
  LEVELS,
  OBJECTIVE_COLORS,
  OBJECTIVES,
  PERSONAS,
  type Prompt
} from '@/lib/community/types'
import { cn } from '@/lib/utils'

import { Button } from '../ui/button'

const allPrompts = promptsData as Prompt[]

function PromptCard({
  prompt,
  onUse
}: {
  prompt: Prompt
  onUse: (p: Prompt) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      navigator.clipboard.writeText(prompt.prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    },
    [prompt.prompt]
  )

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{CATEGORY_ICONS[prompt.category] || '📋'}</span>
          <span className="truncate max-w-[160px]">{prompt.category}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {prompt.heartbeat && (
            <span
              className="flex items-center gap-1 rounded-full border border-pink-500/20 bg-pink-500/10 px-2 py-0.5 text-[10px] font-medium text-pink-500"
              title="Compatible Heartbeat — peut tourner en agent autonome"
            >
              <Activity className="size-3" />
              Auto
            </span>
          )}
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-medium',
              LEVEL_COLORS[prompt.level]
            )}
          >
            {prompt.level}
          </span>
        </div>
      </div>

      <h3 className="text-sm font-semibold leading-snug">{prompt.title}</h3>

      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
        {prompt.prompt.slice(0, 200)}
        {prompt.prompt.length > 200 && '...'}
      </p>

      <div className="flex flex-wrap gap-1">
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-medium',
            OBJECTIVE_COLORS[prompt.objective]
          )}
        >
          {prompt.objective}
        </span>
        <span className="rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
          {prompt.persona}
        </span>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Sparkles className="size-3" />
        <span className="line-clamp-1">{prompt.expectedOutput}</span>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button
          variant="default"
          size="sm"
          className="h-7 flex-1 gap-1.5 text-xs"
          onClick={() => onUse(prompt)}
        >
          <ArrowRight className="size-3" />
          Utiliser
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleCopy}
          title="Copier le prompt"
        >
          {copied ? (
            <Check className="size-3 text-green-500" />
          ) : (
            <Copy className="size-3" />
          )}
        </Button>
      </div>
    </div>
  )
}

function FilterPills({
  label,
  options,
  selected,
  onToggle,
  colorMap
}: {
  label: string
  options: readonly string[]
  selected: Set<string>
  onToggle: (value: string) => void
  colorMap?: Record<string, string>
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isActive = selected.has(opt)
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                isActive
                  ? colorMap?.[opt] ||
                      'border-primary bg-primary/10 text-primary'
                  : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CommunityDashboard() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  )
  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(
    new Set()
  )
  const [selectedObjectives, setSelectedObjectives] = useState<Set<string>>(
    new Set()
  )
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set())
  const [heartbeatOnly, setHeartbeatOnly] = useState(false)

  const toggle = useCallback(
    (
      set: Set<string>,
      setter: React.Dispatch<React.SetStateAction<Set<string>>>,
      value: string
    ) => {
      setter(prev => {
        const next = new Set(prev)
        if (next.has(value)) next.delete(value)
        else next.add(value)
        return next
      })
    },
    []
  )

  const hasFilters =
    selectedCategories.size > 0 ||
    selectedPersonas.size > 0 ||
    selectedObjectives.size > 0 ||
    selectedLevels.size > 0 ||
    heartbeatOnly ||
    search.length > 0

  const clearFilters = useCallback(() => {
    setSelectedCategories(new Set())
    setSelectedPersonas(new Set())
    setSelectedObjectives(new Set())
    setSelectedLevels(new Set())
    setHeartbeatOnly(false)
    setSearch('')
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allPrompts.filter(p => {
      if (selectedCategories.size > 0 && !selectedCategories.has(p.category))
        return false
      if (selectedPersonas.size > 0 && !selectedPersonas.has(p.persona))
        return false
      if (selectedObjectives.size > 0 && !selectedObjectives.has(p.objective))
        return false
      if (selectedLevels.size > 0 && !selectedLevels.has(p.level)) return false
      if (heartbeatOnly && !p.heartbeat) return false
      if (q) {
        return (
          p.title.toLowerCase().includes(q) ||
          p.prompt.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q) ||
          p.persona.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [
    search,
    selectedCategories,
    selectedPersonas,
    selectedObjectives,
    selectedLevels,
    heartbeatOnly
  ])

  const handleUse = useCallback(
    (prompt: Prompt) => {
      const q = encodeURIComponent(prompt.prompt)
      router.push(`/search?q=${q}`)
    },
    [router]
  )

  const stats = useMemo(
    () => ({
      total: allPrompts.length,
      heartbeat: allPrompts.filter(p => p.heartbeat).length,
      categories: new Set(allPrompts.map(p => p.category)).size,
      personas: new Set(allPrompts.map(p => p.persona)).size
    }),
    []
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Communauté</h1>
            <p className="text-xs text-muted-foreground">
              {stats.total} prompts &middot; {stats.categories} catégories
              &middot; {stats.personas} personas &middot; {stats.heartbeat}{' '}
              heartbeat
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un prompt..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-border/50 bg-muted/30 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-border focus:bg-background"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="size-3.5" />
            Filtres
            {hasFilters && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {selectedCategories.size +
                  selectedPersonas.size +
                  selectedObjectives.size +
                  selectedLevels.size +
                  (heartbeatOnly ? 1 : 0)}
              </span>
            )}
          </Button>
          <button
            onClick={() => setHeartbeatOnly(!heartbeatOnly)}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all',
              heartbeatOnly
                ? 'border-pink-500/30 bg-pink-500/10 text-pink-500'
                : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            <Activity className="size-3.5" />
            Heartbeat
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filtres avancés</span>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Réinitialiser
                </button>
              )}
            </div>
            <FilterPills
              label="Catégorie"
              options={CATEGORIES}
              selected={selectedCategories}
              onToggle={v =>
                toggle(selectedCategories, setSelectedCategories, v)
              }
            />
            <FilterPills
              label="Persona"
              options={PERSONAS}
              selected={selectedPersonas}
              onToggle={v => toggle(selectedPersonas, setSelectedPersonas, v)}
            />
            <FilterPills
              label="Objectif"
              options={OBJECTIVES}
              selected={selectedObjectives}
              onToggle={v =>
                toggle(selectedObjectives, setSelectedObjectives, v)
              }
              colorMap={OBJECTIVE_COLORS}
            />
            <FilterPills
              label="Niveau"
              options={LEVELS}
              selected={selectedLevels}
              onToggle={v => toggle(selectedLevels, setSelectedLevels, v)}
              colorMap={LEVEL_COLORS}
            />
          </div>
        )}
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-8 sm:px-6">
        <div className="mb-3 text-xs text-muted-foreground">
          {filtered.length} prompt{filtered.length !== 1 ? 's' : ''}{' '}
          {hasFilters ? 'trouvé' + (filtered.length !== 1 ? 's' : '') : ''}
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Aucun prompt ne correspond à vos filtres.
            </p>
            <button
              onClick={clearFilters}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(p => (
              <PromptCard key={p.id} prompt={p} onUse={handleUse} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
