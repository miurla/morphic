import { NativeIconName } from '@/lib/native/icon-map'
import { SearchMode } from '@/lib/types/search'

export interface SearchModeConfig {
  value: SearchMode
  label: string
  description: string
  icon: NativeIconName
  color: string
}

// Centralized search mode configuration
export const SEARCH_MODE_CONFIGS: SearchModeConfig[] = [
  {
    value: 'quick',
    label: 'Quick',
    description: 'Streamlined search for fast, concise responses',
    icon: 'search',
    color: 'text-amber-500'
  },
  {
    value: 'adaptive',
    label: 'Adaptive',
    description: 'Adaptive agentic search with intelligent query understanding',
    icon: 'adaptive',
    color: 'text-violet-500'
  }
]

// Helper function to get a specific mode config
export function getSearchModeConfig(
  mode: SearchMode
): SearchModeConfig | undefined {
  return SEARCH_MODE_CONFIGS.find(config => config.value === mode)
}
