import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapAlertSubscriptionRow,
  type AlertSubscription,
  type AlertType,
  type AlertFrequency,
  type AlertChannel
} from '../types'

type DB = SupabaseClient

// ---------------------------------------------------------------
// Read
// ---------------------------------------------------------------

export async function getUserAlerts(
  db: DB,
  userId: string
): Promise<AlertSubscription[]> {
  const { data, error } = await db
    .from('alert_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapAlertSubscriptionRow)
}

// ---------------------------------------------------------------
// Create
// ---------------------------------------------------------------

export async function createAlert(
  db: DB,
  userId: string,
  input: {
    name: string
    alertType: AlertType
    topicId?: string
    keywords?: string[]
    regions?: string[]
    channels?: AlertChannel[]
    frequency?: AlertFrequency
    webhookUrl?: string
  }
): Promise<AlertSubscription> {
  const { data, error } = await db
    .from('alert_subscriptions')
    .insert({
      user_id: userId,
      name: input.name,
      alert_type: input.alertType,
      topic_id: input.topicId ?? null,
      keywords: input.keywords ?? [],
      regions: input.regions ?? [],
      channels: input.channels ?? ['email'],
      frequency: input.frequency ?? 'daily',
      webhook_url: input.webhookUrl ?? null
    })
    .select()
    .single()

  if (error) throw error
  return mapAlertSubscriptionRow(data)
}

// ---------------------------------------------------------------
// Update
// ---------------------------------------------------------------

export async function updateAlert(
  db: DB,
  alertId: string,
  updates: Partial<
    Pick<
      AlertSubscription,
      | 'name'
      | 'keywords'
      | 'regions'
      | 'channels'
      | 'frequency'
      | 'webhookUrl'
      | 'isActive'
    >
  >
): Promise<AlertSubscription> {
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined)       row.name = updates.name
  if (updates.keywords !== undefined)   row.keywords = updates.keywords
  if (updates.regions !== undefined)    row.regions = updates.regions
  if (updates.channels !== undefined)   row.channels = updates.channels
  if (updates.frequency !== undefined)  row.frequency = updates.frequency
  if (updates.webhookUrl !== undefined) row.webhook_url = updates.webhookUrl
  if (updates.isActive !== undefined)   row.is_active = updates.isActive

  const { data, error } = await db
    .from('alert_subscriptions')
    .update(row)
    .eq('id', alertId)
    .select()
    .single()

  if (error) throw error
  return mapAlertSubscriptionRow(data)
}

// ---------------------------------------------------------------
// Delete
// ---------------------------------------------------------------

export async function deleteAlert(db: DB, alertId: string): Promise<void> {
  const { error } = await db
    .from('alert_subscriptions')
    .delete()
    .eq('id', alertId)

  if (error) throw error
}
