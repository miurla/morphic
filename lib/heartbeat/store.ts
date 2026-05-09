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
  runAt: number
  resultsCount: number
  results: HeartbeatRunResult[]
  viewToken: string
  notifiedVia: HeartbeatChannel
}

export type Heartbeat = {
  id: string
  chatId: string
  chatTitle: string
  query: string
  frequency: HeartbeatFrequency
  cronExpression?: string
  channel: HeartbeatChannel
  status: HeartbeatStatus
  createdAt: number
  lastRunAt?: number
  nextRunAt?: number
  runs?: HeartbeatRun[]
}

const STORAGE_KEY = 'morphic-heartbeats'

function read(): Heartbeat[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function write(heartbeats: Heartbeat[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(heartbeats))
}

export function getHeartbeats(): Heartbeat[] {
  return read()
}

export function getHeartbeatById(id: string): Heartbeat | undefined {
  return read().find(h => h.id === id)
}

export function getHeartbeatForChat(chatId: string): Heartbeat | undefined {
  return read().find(h => h.chatId === chatId)
}

function generateMockRuns(query: string): HeartbeatRun[] {
  const companies = [
    'Keyrus',
    'Capgemini',
    'Accenture',
    'Sopra Steria',
    'CGI',
    'Atos',
    'NEXTON',
    'Betclic',
    'Cultura',
    'Cdiscount'
  ]
  const titles = [
    'Data Analyst Senior',
    'Business Analyst Data',
    'Data Engineer',
    'BI Analyst',
    'Data Scientist Junior',
    'Analytics Manager',
    'Product Analyst',
    'Data Governance Lead'
  ]
  const locations = [
    'Bordeaux',
    'Mérignac',
    'Pessac',
    'Talence',
    'Paris',
    'Lyon'
  ]
  const statuses: HeartbeatRunResult['status'][] = [
    'new',
    'new',
    'new',
    'saved',
    'ignored'
  ]

  const runs: HeartbeatRun[] = []
  const now = Date.now()

  for (let i = 0; i < 3; i++) {
    const runAt = now - (i + 1) * 86400000
    const count = 2 + Math.floor(Math.random() * 4)
    const results: HeartbeatRunResult[] = []

    for (let j = 0; j < count; j++) {
      results.push({
        id: `${i}-${j}`,
        title: titles[Math.floor(Math.random() * titles.length)],
        company: companies[Math.floor(Math.random() * companies.length)],
        location: locations[Math.floor(Math.random() * locations.length)],
        url: `https://www.linkedin.com/jobs/view/${4400000000 + i * 100 + j}`,
        status: statuses[Math.floor(Math.random() * statuses.length)]
      })
    }

    runs.push({
      id: crypto.randomUUID(),
      runAt,
      resultsCount: count,
      results,
      viewToken: crypto.randomUUID().slice(0, 12),
      notifiedVia: 'email'
    })
  }

  return runs
}

export function createHeartbeat(
  params: Omit<Heartbeat, 'id' | 'createdAt' | 'status' | 'runs'>
): Heartbeat {
  const heartbeats = read()
  const existing = heartbeats.find(h => h.chatId === params.chatId)
  if (existing) return existing

  const hb: Heartbeat = {
    ...params,
    id: crypto.randomUUID(),
    status: 'active',
    createdAt: Date.now(),
    lastRunAt: Date.now() - 86400000,
    runs: generateMockRuns(params.query)
  }
  heartbeats.push(hb)
  write(heartbeats)
  window.dispatchEvent(new CustomEvent('heartbeat-updated'))
  return hb
}

export function toggleHeartbeat(id: string): Heartbeat | null {
  const heartbeats = read()
  const hb = heartbeats.find(h => h.id === id)
  if (!hb) return null
  hb.status = hb.status === 'active' ? 'paused' : 'active'
  write(heartbeats)
  window.dispatchEvent(new CustomEvent('heartbeat-updated'))
  return hb
}

export function deleteHeartbeat(id: string) {
  const heartbeats = read().filter(h => h.id !== id)
  write(heartbeats)
  window.dispatchEvent(new CustomEvent('heartbeat-updated'))
}

export function hasHeartbeat(chatId: string): boolean {
  return read().some(h => h.chatId === chatId)
}

export function updateRunResultStatus(
  heartbeatId: string,
  runId: string,
  resultId: string,
  status: HeartbeatRunResult['status']
) {
  const heartbeats = read()
  const hb = heartbeats.find(h => h.id === heartbeatId)
  if (!hb?.runs) return
  const run = hb.runs.find(r => r.id === runId)
  if (!run) return
  const result = run.results.find(r => r.id === resultId)
  if (!result) return
  result.status = status
  write(heartbeats)
}
