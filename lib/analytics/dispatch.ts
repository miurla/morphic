import {
  captureServerEvent,
  deletePerson,
  getServerFeatureFlag as getServerFeatureFlagProvider,
  type ServerEvent
} from './providers/posthog-server'

export function isAnalyticsEnabled(): boolean {
  return process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
}

/**
 * Evaluate a boolean feature flag for a distinct id. Returns undefined when
 * analytics is disabled or evaluation fails, so callers apply their own
 * default (never throws).
 */
export async function getServerFeatureFlag(
  key: string,
  distinctId: string
): Promise<boolean | undefined> {
  if (!isAnalyticsEnabled()) return undefined

  try {
    return await getServerFeatureFlagProvider(key, distinctId)
  } catch (error) {
    console.error('Failed to evaluate feature flag:', error)
    return undefined
  }
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
