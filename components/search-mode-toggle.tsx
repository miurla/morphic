'use client'

import { cn } from '@/lib/utils'
import { Globe } from 'lucide-react'
import { useState } from 'react'
import { Toggle } from './ui/toggle'

export function SearchModeToggle() {
  const [isSearchMode, setIsSearchMode] = useState(true)

  const handleSearchModeChange = (pressed: boolean) => {
    setIsSearchMode(pressed)
  }

  return (
    <Toggle
      aria-label="Toggle search mode"
      pressed={isSearchMode}
      onPressedChange={handleSearchModeChange}
      variant="outline"
      className={cn(
        'gap-1 px-3 border border-input text-muted-foreground bg-background',
        'data-[state=on]:bg-accent-blue',
        'data-[state=on]:text-accent-blue-foreground',
        'data-[state=on]:border-accent-blue-border',
        'hover:bg-accent hover:text-accent-foreground rounded-full'
      )}
    >
      <Globe className="size-4" />
      <span className="text-xs">Search</span>
    </Toggle>
  )
}
