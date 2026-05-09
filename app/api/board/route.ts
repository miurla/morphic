import { NextResponse } from 'next/server'

const MCP_URL = process.env.MELRON_MCP_URL
const MCP_TOKEN = process.env.MELRON_MCP_TOKEN

async function callMcp(method: string, args: Record<string, unknown> = {}) {
  if (!MCP_URL || !MCP_TOKEN) {
    return null
  }
  const url = `${MCP_URL}?token=${MCP_TOKEN}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: method, arguments: args }
    })
  })
  const text = await res.text()
  const dataLine = text.split('data: ')[1]
  if (!dataLine) return null
  const parsed = JSON.parse(dataLine)
  const content = parsed?.result?.content?.[0]?.text
  if (!content) return null
  return JSON.parse(content)
}

export async function GET() {
  try {
    const data = await callMcp('list_cards')
    if (!data) {
      return NextResponse.json(
        { error: 'MCP not configured' },
        { status: 503 }
      )
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('[board] Error fetching board:', error)
    return NextResponse.json(
      { error: 'Failed to fetch board' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, ...args } = body

    if (action === 'move_card') {
      const data = await callMcp('move_card', args)
      return NextResponse.json(data ?? { ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[board] Error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
