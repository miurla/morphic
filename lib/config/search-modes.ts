import { createElement } from 'react'

import { Icon } from '@iconify/react'

import { SearchMode } from '@/lib/types/search'

function SpeedIcon({ className }: { className?: string }) {
  return createElement(Icon, { icon: 'solar:bolt-bold', className })
}

function QualityIcon({ className }: { className?: string }) {
  return createElement(Icon, { icon: 'solar:brain-bold', className })
}

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
    value: 'quick',
    label: 'Speed',
    description: 'Fast DeepSeek Flash search for concise answers',
    icon: SpeedIcon,
    color: 'text-amber-500'
  },
  {
    value: 'adaptive',
    label: 'Quality',
    description: 'DeepSeek Pro reasoning for deeper evidence synthesis',
    icon: QualityIcon,
    color: 'text-violet-500'
  }
]

// Helper function to get a specific mode config
export function getSearchModeConfig(
  mode: SearchMode
): SearchModeConfig | undefined {
  return SEARCH_MODE_CONFIGS.find(config => config.value === mode)
}
