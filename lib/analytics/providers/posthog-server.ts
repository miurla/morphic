import { PostHog } from 'posthog-node'

let client: PostHog | null = null

function getClient(): PostHog | null {
  const key = process.env.POSTHOG_KEY
  if (!key) return null

  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0
    })
  }

  return client
}

export interface ServerEvent {
  event: string
  distinctId: string
  properties?: Record<string, unknown>
}

export async function captureServerEvent({
  event,
  distinctId,
  properties
}: ServerEvent): Promise<void> {
  const ph = getClient()
  if (!ph) return

  ph.capture({ distinctId, event, properties })
  await ph.flush()
}

/**
 * Delete a person and their events via the management API.
 * Requires a dedicated personal API key scoped to person:write.
 * No-op when the key or project id is not configured.
 */
export async function deletePerson(distinctId: string): Promise<void> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID
  const apiHost = process.env.POSTHOG_API_HOST

  if (!apiKey || !projectId || !apiHost) return

  const res = await fetch(
    `${apiHost}/api/environments/${projectId}/persons/bulk_delete`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ distinct_ids: [distinctId], delete_events: true })
    }
  )

  if (!res.ok) {
    throw new Error(`PostHog person deletion failed: ${res.status}`)
  }
}
