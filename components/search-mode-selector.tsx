'use client'

import { useEffect, useState } from 'react'

import { Check, ChevronDown, GitBranch, Sparkles, Zap } from 'lucide-react'

import { SearchMode } from '@/lib/agents/researcher'
import { cn } from '@/lib/utils'
import { getCookie, setCookie } from '@/lib/utils/cookies'

import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu'

interface SearchModeOption {
  value: SearchMode
  label: string
  description: string
  model: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const searchModes: SearchModeOption[] = [
  {
    value: 'quick',
    label: 'Quick',
    description: 'Fast, concise responses',
    model: 'MoonshotAI/Kimi K2',
    icon: Zap,
    color: 'text-yellow-500'
  },
  {
    value: 'planning',
    label: 'Planning',
    description: 'Detailed, structured research',
    model: 'OpenAI GPT-5',
    icon: GitBranch,
    color: 'text-blue-500'
  },
  {
    value: 'auto',
    label: 'Auto',
    description: 'Balanced, adaptive approach',
    model: 'Auto',
    icon: Sparkles,
    color: 'text-purple-500'
  }
]

export function SearchModeSelector() {
  const [value, setValue] = useState<SearchMode>('auto')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const savedMode = getCookie('searchMode')
    if (savedMode && ['quick', 'planning', 'auto'].includes(savedMode)) {
      setValue(savedMode as SearchMode)
    }
  }, [])

  const handleModeSelect = (mode: SearchMode) => {
    setValue(mode)
    setCookie('searchMode', mode)
    setOpen(false)
  }

  const selectedMode = searchModes.find(mode => mode.value === value)
  const Icon = selectedMode?.icon || Sparkles

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="text-sm rounded-full shadow-none gap-1 transition-all !ring-0 !outline-none !ring-offset-0 [&:focus]:!ring-0 [&:focus]:!outline-none [&:focus-visible]:!ring-0 [&:focus-visible]:!ring-offset-0"
        >
          <Icon
            className={cn('h-4 w-4 transition-colors', selectedMode?.color)}
          />
          <span className="text-xs font-medium">{selectedMode?.label}</span>
          <ChevronDown
            className={cn(
              'h-3 w-3 ml-1 opacity-50 transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" sideOffset={5}>
        {searchModes.map(mode => {
          const ModeIcon = mode.icon
          const isSelected = value === mode.value
          return (
            <DropdownMenuItem
              key={mode.value}
              onClick={() => handleModeSelect(mode.value)}
              className="relative flex flex-col items-start gap-1 py-2 pl-8 pr-2 cursor-pointer focus:outline-none"
            >
              {isSelected && (
                <Check className="absolute left-2 top-2.5 h-4 w-4" />
              )}
              <div className="flex items-center gap-2">
                <ModeIcon
                  className={cn('h-4 w-4 transition-colors', mode.color)}
                />
                <span className="text-sm font-medium">{mode.label}</span>
              </div>
              <div className="flex flex-col gap-0.5 ml-6">
                <span className="text-xs text-muted-foreground">
                  {mode.description}
                </span>
                <span className="text-xs text-muted-foreground/70">
                  {mode.model}
                </span>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
