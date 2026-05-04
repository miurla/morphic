export interface Model {
  id: string
  name: string
  provider: string
  providerId: string
  providerOptions?: Record<string, any>
  contextWindow?: number
  recommendedFor?: string
  default?: boolean
}
