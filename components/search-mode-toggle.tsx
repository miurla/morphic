'use client'

import { cn } from '@/lib/utils'
import { getCookie, setCookie } from '@/lib/utils/cookies'
import { ChevronDown, Globe } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu'

export function SearchModeToggle() {
  const [searchMode, setSearchMode] = useState<'academic' | 'normal'>('normal')

  useEffect(() => {
    const savedMode = getCookie('search-mode')
    if (savedMode) {
      setSearchMode(savedMode as 'academic' | 'normal')
    }
  }, [])

  const handleSearchModeChange = (mode: 'academic' | 'normal') => {
    setSearchMode(mode)
    setCookie('search-mode', mode)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          className={cn(
            'gap-1 px-3 border border-input text-muted-foreground bg-background rounded-full hover:bg-accent-blue hover:text-accent-blue-foreground hover:border-accent-blue-border',
            'bg-accent-blue text-accent-blue-foreground border-accent-blue-border'
          )}
        >
          <Globe className="size-4" />
          <span className="text-xs">
            {searchMode === 'academic' ? 'Academic' : 'Normal'}
          </span>
          <ChevronDown className="size-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleSearchModeChange('normal')}>
          Normal
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSearchModeChange('academic')}>
          Academic
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
