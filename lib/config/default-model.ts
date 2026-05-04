import { Model } from '@/lib/types/models'

export const DEFAULT_MODEL: Model = {
  id: 'deepseek-v4-pro',
  name: 'DeepSeek V4 Pro',
  provider: 'DeepSeek',
  providerId: 'deepseek',
  contextWindow: 1000000,
  recommendedFor: 'Quality mode, complex agricultural queries, synthesis tasks',
  default: true
}
