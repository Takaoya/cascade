export const maxDuration = 30 // allow up to 30s for parallel Kalshi calls

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fetchTopKalshiMarkets, kalshiDollarsToProbability } from '@/lib/kalshi'

// TopMarket type is defined in app/top/page.tsx to avoid importing server code into client components

// GET /api/markets/top
// Returns top 10 political/economic Kalshi markets sorted by activity, enriched with DB correlation counts.
export async function GET() {
  try {
    const [kalshiMarkets, supabase] = await Promise.all([
      fetchTopKalshiMarkets(),
      Promise.resolve(createServiceClient()),
    ])

    if (kalshiMarkets.length === 0) {
      return NextResponse.json({ markets: [], fetched_at: new Date().toISOString(), error: 'No markets returned from Kalshi' })
    }

    const top15 = kalshiMarkets.slice(0, 15)
    const tickers = top15.map(m => m.ticker)

    const { data: dbMarkets } = await supabase
      .from('markets')
      .select('id, external_id')
      .in('external_id', tickers)

    const dbById = Object.fromEntries((dbMarkets ?? []).map(m => [m.external_id, m.id]))

    const dbIds = Object.values(dbById)
    const relCounts: Record<string, number> = {}

    if (dbIds.length > 0) {
      const { data: rels } = await supabase
        .from('market_relationships')
        .select('market_a_id')
        .in('market_a_id', dbIds)

      ;(rels ?? []).forEach(r => {
        relCounts[r.market_a_id] = (relCounts[r.market_a_id] ?? 0) + 1
      })
    }

    const result = top15.slice(0, 10).map(m => {
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
  } catch (err) {
    console.error('[/api/markets/top]', err)
    return NextResponse.json({ markets: [], error: 'Failed to fetch market data', fetched_at: new Date().toISOString() }, { status: 500 })
  }
}
