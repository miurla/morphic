import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { heartbeatRuns, heartbeats, generateId } from '@/lib/db/schema'

const MCP_URL = process.env.MELRON_MCP_URL
const MCP_TOKEN = process.env.MELRON_MCP_TOKEN
const WASENDER_API_KEY = process.env.WASENDER_API_KEY
const BASE_URL =
  process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://morphic-qualify-x.vercel.app'

async function callMcp(toolName: string, args: Record<string, unknown>) {
  if (!MCP_URL || !MCP_TOKEN) return null
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
      params: { name: toolName, arguments: args }
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

async function sendWhatsApp(to: string, message: string) {
  if (!WASENDER_API_KEY) return false
  const cleanNumber = to.replace(/[^0-9]/g, '')
  const res = await fetch('https://www.wasenderapi.com/api/send-message', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WASENDER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ to: cleanNumber, text: message })
  })
  return res.ok
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { heartbeatId } = body

    if (!heartbeatId) {
      return NextResponse.json(
        { error: 'heartbeatId required' },
        { status: 400 }
      )
    }

    const [hb] = await db
      .select()
      .from(heartbeats)
      .where(eq(heartbeats.id, heartbeatId))
      .limit(1)

    if (!hb) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Determine which MCP tool to use based on query
    const query = hb.query.toLowerCase()
    let toolName = 'smart_job_search'
    let toolArgs: Record<string, unknown> = {
      query: hb.query,
      max_results: 5
    }

    if (
      query.includes('recrute') ||
      query.includes('recruteur') ||
      query.includes('réseau') ||
      query.includes('network') ||
      query.includes('tendance') ||
      query.includes('quoi de neuf')
    ) {
      toolName = 'smart_network_update'
      toolArgs = { topic: hb.query }
    } else if (
      query.includes('profil') ||
      query.includes('vp') ||
      query.includes('décideur') ||
      query.includes('directeur') ||
      query.includes('people') ||
      query.includes('trouver des')
    ) {
      toolName = 'smart_people_search'
      toolArgs = { query: hb.query, max_results: 5 }
    }

    console.log(`[heartbeat] Running ${toolName} for "${hb.query}"`)

    // Execute MCP tool
    const mcpResult = await callMcp(toolName, toolArgs)

    // Extract results
    let results: any[] = []
    let resultsCount = 0

    if (mcpResult) {
      if (mcpResult.curated_jobs) {
        results = mcpResult.curated_jobs.map((j: any) => ({
          id: j.job_id ?? generateId().slice(0, 8),
          title: j.title,
          company: j.company ?? '',
          location: j.location,
          url: j.url ?? j.linkedin_url,
          status: 'new'
        }))
      } else if (mcpResult.people) {
        results = mcpResult.people.map((p: any, i: number) => ({
          id: `p-${i}`,
          title: p.full_name ?? p.anonymized_name,
          company: p.headline ?? '',
          location: p.location,
          url: p.profile_url,
          status: 'new'
        }))
      } else if (mcpResult.posts) {
        results = mcpResult.posts.slice(0, 5).map((p: any, i: number) => ({
          id: `post-${i}`,
          title: p.author_name,
          company: p.text_preview?.slice(0, 80) ?? '',
          url: p.share_url,
          status: 'new'
        }))
      }
      resultsCount = results.length
    }

    // Save run to DB
    const viewToken = generateId().slice(0, 12)
    const [run] = await db
      .insert(heartbeatRuns)
      .values({
        heartbeatId: hb.id,
        results,
        resultsCount,
        viewToken,
        notifiedVia: hb.channel
      })
      .returning()

    // Update lastRunAt
    await db
      .update(heartbeats)
      .set({ lastRunAt: new Date() })
      .where(eq(heartbeats.id, hb.id))

    // Send WhatsApp notification
    if (hb.channel === 'whatsapp' && hb.whatsappNumber && resultsCount > 0) {
      const viewUrl = `${BASE_URL}/heartbeat/view/${viewToken}`
      const message = `🔔 Melron Heartbeat\n\n${resultsCount} nouveau${resultsCount > 1 ? 'x' : ''} résultat${resultsCount > 1 ? 's' : ''} pour "${hb.chatTitle}"\n\n${results
        .slice(0, 3)
        .map((r: any) => `• ${r.title}${r.company ? ` — ${r.company}` : ''}`)
        .join('\n')}\n\n👉 Voir et agir : ${viewUrl}`

      const sent = await sendWhatsApp(hb.whatsappNumber, message)
      console.log(
        `[heartbeat] WhatsApp ${sent ? 'sent' : 'failed'} to ${hb.whatsappNumber}`
      )
    }

    console.log(
      `[heartbeat] Run complete: ${resultsCount} results, token=${viewToken}`
    )

    return NextResponse.json({
      runId: run.id,
      resultsCount,
      viewToken
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[heartbeat/run] Error:', msg, error)
    return NextResponse.json(
      { error: 'Run failed', detail: msg },
      { status: 500 }
    )
  }
}
