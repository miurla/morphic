'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/lib/store'

export function SearchModeToggle() {
  const isPmcResearchMode = useAppStore(state => state.isPmcResearchMode)
  const setIsPmcResearchMode = useAppStore(state => state.setIsPmcResearchMode)

  const handleCheckedChange = (checked: boolean) => {
    console.log('[SearchModeToggle] Toggled to:', checked)
    setIsPmcResearchMode(checked)
  }

  return (
    <div className="flex items-center space-x-2">
      <Label htmlFor="search-mode-toggle" className="text-sm">
        Search
      </Label>
      <Switch
        id="search-mode-toggle"
        checked={isPmcResearchMode}
        onCheckedChange={handleCheckedChange}
        aria-label="Toggle search mode"
      />
    </div>
  )
}
