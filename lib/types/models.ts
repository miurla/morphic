export interface Model {
  id: string
  name: string
  provider: string
  providerId: string
  capabilities?: string[]
  providerOptions?: Record<string, any>
}
