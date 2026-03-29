import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fetchAllCuratedMarkets, kalshiDollarsToProbability } from '@/lib/kalshi'

export interface TopMarket {
  ticker: string
  event_ticker: string
  title: string
  probability: number
  volume_24h: number
  open_interest: number
  liquidity: number
  db_id: string | null
  relationship_count: number
}

// GET /api/markets/top
// Returns top 10 political/economic Kalshi markets by 24h volume, enriched with DB correlation counts.
export async function GET() {
  const [kalshiMarkets, supabase] = await Promise.all([
    fetchAllCuratedMarkets(),
    Promise.resolve(createServiceClient()),
  ])

  // Take top 15 to have buffer in case some have no DB entry
  const top15 = kalshiMarkets.slice(0, 15)

  // Fetch DB entries for these tickers
  const tickers = top15.map(m => m.ticker)
  const { data: dbMarkets } = await supabase
    .from('markets')
    .select('id, external_id')
    .in('external_id', tickers)

  const dbById = Object.fromEntries((dbMarkets ?? []).map(m => [m.external_id, m.id]))

  // Fetch relationship counts for markets that have DB entries
  const dbIds = Object.values(dbById)
  let relCounts: Record<string, number> = {}

  if (dbIds.length > 0) {
    const { data: rels } = await supabase
      .from('market_relationships')
      .select('market_a_id')
      .in('market_a_id', dbIds)

    ;(rels ?? []).forEach(r => {
      relCounts[r.market_a_id] = (relCounts[r.market_a_id] ?? 0) + 1
    })
  }

  const result: TopMarket[] = top15.slice(0, 10).map(m => {
    const dbId = dbById[m.ticker] ?? null
    return {
      ticker: m.ticker,
      event_ticker: m.event_ticker,
      title: m.title,
      probability: kalshiDollarsToProbability(m),
      volume_24h: m.volume_24h_fp ?? 0,
      open_interest: m.open_interest_fp ?? 0,
      liquidity: parseFloat(m.liquidity_dollars ?? '0') || 0,
      db_id: dbId,
      relationship_count: dbId ? (relCounts[dbId] ?? 0) : 0,
    }
  })

  return NextResponse.json({ markets: result, fetched_at: new Date().toISOString() })
}
