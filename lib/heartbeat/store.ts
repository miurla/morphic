// DB-backed heartbeat store — all operations go through /api/heartbeat

export type HeartbeatChannel = 'email' | 'whatsapp'
export type HeartbeatFrequency = 'daily' | 'weekly' | 'custom'
export type HeartbeatStatus = 'active' | 'paused'

export type HeartbeatRunResult = {
  id: string
  title: string
  company: string
  location?: string
  url?: string
  status: 'new' | 'saved' | 'ignored' | 'applied'
}

export type HeartbeatRun = {
  id: string
  runAt: string
  resultsCount: number
  results: HeartbeatRunResult[]
  viewToken: string
  notifiedVia: HeartbeatChannel
}

export type Heartbeat = {
  id: string
  userId: string
  chatId: string | null
  chatTitle: string
  query: string
  frequency: HeartbeatFrequency
  channel: HeartbeatChannel
  whatsappNumber: string | null
  status: HeartbeatStatus
  lastRunAt: string | null
  createdAt: string
  runs?: HeartbeatRun[]
}

export async function getHeartbeats(): Promise<Heartbeat[]> {
  try {
    const res = await fetch('/api/heartbeat')
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function createHeartbeat(params: {
  chatId: string
  chatTitle: string
  query: string
  frequency?: HeartbeatFrequency
  channel?: HeartbeatChannel
}): Promise<Heartbeat | null> {
  try {
    const res = await fetch('/api/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...params })
    })
    if (!res.ok) return null
    const hb = await res.json()
    window.dispatchEvent(new CustomEvent('heartbeat-updated'))
    return hb
  } catch {
    return null
  }
}

export async function toggleHeartbeat(id: string): Promise<Heartbeat | null> {
  try {
    const res = await fetch('/api/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', id })
    })
    if (!res.ok) return null
    const hb = await res.json()
    window.dispatchEvent(new CustomEvent('heartbeat-updated'))
    return hb
  } catch {
    return null
  }
}

export async function deleteHeartbeat(id: string): Promise<void> {
  try {
    await fetch('/api/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id })
    })
    window.dispatchEvent(new CustomEvent('heartbeat-updated'))
  } catch {}
}

export async function hasHeartbeat(chatId: string): Promise<boolean> {
  const hbs = await getHeartbeats()
  return hbs.some(h => h.chatId === chatId)
}
