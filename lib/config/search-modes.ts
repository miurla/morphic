import { ListChecks, Search, Sparkles } from 'lucide-react'

import { SearchMode } from '@/lib/types/search'

export interface SearchModeConfig {
  value: SearchMode
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

// Centralized search mode configuration
export const SEARCH_MODE_CONFIGS: SearchModeConfig[] = [
  {
    value: 'adaptive',
    label: 'Adaptive',
    description: 'Automatically adjusts search strategy to match your needs',
    icon: Sparkles,
    color: 'text-violet-500'
  },
  {
    value: 'planning',
    label: 'Planning',
    description: 'Structured multi-step approach for comprehensive research',
    icon: ListChecks,
    color: 'text-blue-500'
  },
  {
    value: 'quick',
    label: 'Quick',
    description: 'Streamlined search for fast, concise responses',
    icon: Search,
    color: 'text-amber-500'
  }
]

// Helper function to get a specific mode config
export function getSearchModeConfig(
  mode: SearchMode
): SearchModeConfig | undefined {
  return SEARCH_MODE_CONFIGS.find(config => config.value === mode)
}
