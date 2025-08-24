import { ListChecks, Search, Sparkles } from 'lucide-react'

import { Model } from '@/lib/types/models'
import { SearchMode } from '@/lib/types/search'

export interface SearchModeConfig {
  value: SearchMode
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  displayModel: string // Model name shown in UI
  actualModel: Model // Actual model configuration used by API
}

// Centralized search mode configuration
export const SEARCH_MODE_CONFIGS: SearchModeConfig[] = [
  {
    value: 'adaptive',
    label: 'Adaptive',
    description: 'Automatically adjusts search strategy to match your needs',
    icon: Sparkles,
    color: 'text-violet-500',
    displayModel: 'Auto',
    actualModel: {
      id: 'gpt-5-mini-2025-08-07',
      name: 'GPT-5 mini',
      provider: 'OpenAI',
      providerId: 'openai',
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
          reasoningSummary: 'detailed'
        }
      }
    }
  },
  {
    value: 'planning',
    label: 'Planning',
    description: 'Structured multi-step approach for comprehensive research',
    icon: ListChecks,
    color: 'text-blue-500',
    displayModel: 'OpenAI GPT-5',
    actualModel: {
      id: 'gpt-5-2025-08-07',
      name: 'GPT-5',
      provider: 'OpenAI',
      providerId: 'openai',
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
          reasoningSummary: 'detailed'
        }
      }
    }
  },
  {
    value: 'quick',
    label: 'Quick',
    description: 'Streamlined search for fast, concise responses',
    icon: Search,
    color: 'text-amber-500',
    displayModel: 'MoonshotAI/Kimi K2',
    actualModel: {
      id: 'gpt-5-nano-2025-08-07',
      name: 'GPT-5 nano',
      provider: 'OpenAI',
      providerId: 'openai',
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
          reasoningSummary: 'detailed'
        }
      }
    }
  }
]

// Helper function to get model mapping for API use
export function getSearchModeModels(): Record<SearchMode, Model> {
  return SEARCH_MODE_CONFIGS.reduce(
    (acc, config) => {
      acc[config.value] = config.actualModel
      return acc
    },
    {} as Record<SearchMode, Model>
  )
}

// Helper function to get a specific mode config
export function getSearchModeConfig(
  mode: SearchMode
): SearchModeConfig | undefined {
  return SEARCH_MODE_CONFIGS.find(config => config.value === mode)
}
