import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'
const CATEGORIES = ['Politics', 'Economics', 'Elections', 'Financial', 'Climate', 'Technology']

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchEventTickers(headers: Record<string, string>): Promise<string[]> {
  const tickers: string[] = []
  for (const category of CATEGORIES) {
    let cursor: string | null = null
    let page = 0
    while (true) {
      await sleep(150)
      const params = new URLSearchParams({ status: 'open', limit: '200', category })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`${KALSHI_BASE}/events?${params}`, { headers })
      if (!res.ok) break
      const data = await res.json()
      const events: { event_ticker?: string; ticker?: string }[] = data.events ?? []
      events.forEach(e => tickers.push(e.event_ticker ?? e.ticker ?? ''))
      cursor = data.cursor ?? null
      page++
      if (!cursor || events.length === 0 || page > 10) break
    }
  }
  return [...new Set(tickers)].filter(Boolean)
}

function getPrice(market: { yes_bid_dollars?: string; yes_ask_dollars?: string; last_price_dollars?: string }): number {
  const bid = parseFloat(market.yes_bid_dollars ?? '0') || 0
  const ask = parseFloat(market.yes_ask_dollars ?? '0') || 0
  if (bid > 0 && ask > 0) return (bid + ask) / 2
  return parseFloat(market.last_price_dollars ?? '0') || 0
}

/**
 * GET /api/sync
 *
 * Triggers a full Kalshi market sync. Called by Vercel Cron daily at 06:00 UTC.
 * Protected by CRON_SECRET env var — Vercel sends Authorization: Bearer <secret> automatically.
 *
 * Manual trigger:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" https://your-domain/api/sync
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const kalshiKey = process.env.KALSHI_API_KEY
  if (!kalshiKey) {
    return NextResponse.json({ error: 'KALSHI_API_KEY not set' }, { status: 500 })
  }

  const headers = { Authorization: `Bearer ${kalshiKey}`, 'Content-Type': 'application/json' }
  const supabase = createServiceClient()
  const start = Date.now()

  try {
    // 1. Discover all event tickers
    const eventTickers = await fetchEventTickers(headers)

    // 2. Fetch markets for each event
    const allMarkets: Record<string, unknown>[] = []
    for (const eventTicker of eventTickers) {
      await sleep(150)
      const res = await fetch(
        `${KALSHI_BASE}/markets?event_ticker=${eventTicker}&status=open&limit=20`,
        { headers }
      )
      if (res.ok) {
        const data = await res.json()
        allMarkets.push(...(data.markets ?? []))
      }
    }

    // 3. Upsert into Supabase in batches of 100
    const BATCH = 100
    let upserted = 0
    for (let i = 0; i < allMarkets.length; i += BATCH) {
      const batch = allMarkets.slice(i, i + BATCH)
      const rows = batch.map(m => ({
        source: 'kalshi',
        external_id: m.ticker,
        title: m.title,
        probability: Math.min(1, Math.max(0, getPrice(m as Parameters<typeof getPrice>[0]))),
        category: m.event_ticker,
        last_updated: new Date().toISOString(),
      }))
      const { error } = await supabase
        .from('markets')
        .upsert(rows, { onConflict: 'source,external_id' })
      if (!error) upserted += rows.length
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    return NextResponse.json({
      ok: true,
      events_discovered: eventTickers.length,
      markets_fetched: allMarkets.length,
      markets_synced: upserted,
      elapsed_seconds: parseFloat(elapsed),
      synced_at: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
