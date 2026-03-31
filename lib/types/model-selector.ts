import { Model } from '@/lib/types/models'

export interface ModelSelectorData {
  enabled: boolean
  modelsByProvider: Record<string, Model[]>
  selectedModelKey: string
  hasAvailableModels: boolean
}
