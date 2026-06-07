import {
  captureServerEvent,
  deletePerson,
  type ServerEvent
} from './providers/posthog-server'

export function isAnalyticsEnabled(): boolean {
  return process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
}

export async function capture(event: ServerEvent): Promise<void> {
  if (!isAnalyticsEnabled()) return

  try {
    await captureServerEvent(event)
  } catch (error) {
    console.error('Failed to capture analytics event:', error)
  }
}

export async function deleteAnalyticsPerson(distinctId: string): Promise<void> {
  if (!isAnalyticsEnabled()) return

  try {
    await deletePerson(distinctId)
  } catch (error) {
    console.error('Failed to delete analytics person:', error)
  }
}
