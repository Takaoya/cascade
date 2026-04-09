import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fetchTopKalshiMarkets, kalshiDollarsToProbability } from '@/lib/kalshi'

// GET /api/markets/top
// Returns top markets ranked by 24h trading volume from Kalshi live data,
// enriched with relationship counts from the DB.
export async function GET() {
  try {
    const supabase = createServiceClient()

    // Fetch live Kalshi data (has volume_24h_fp) + DB relationship counts in parallel
    const [kalshiMarkets, dbResult, relsResult] = await Promise.all([
      fetchTopKalshiMarkets(),
      supabase.from('markets').select('id, external_id, title, probability, category, last_updated').eq('source', 'kalshi'),
      supabase.from('market_relationships').select('market_a_id'),
    ])

    const dbMarkets = dbResult.data ?? []
    const rels = relsResult.data ?? []

    // Build relationship count map keyed by market DB id
    const relCounts: Record<string, number> = {}
    rels.forEach(r => {
      relCounts[r.market_a_id] = (relCounts[r.market_a_id] ?? 0) + 1
    })

    // Build DB lookup by ticker (external_id)
    const dbByTicker: Record<string, typeof dbMarkets[0]> = {}
    dbMarkets.forEach(m => { if (m.external_id) dbByTicker[m.external_id] = m })

    // Merge live Kalshi data with DB relationship counts
    const markets = kalshiMarkets
      .filter(km => {
        const prob = kalshiDollarsToProbability(km)
        return prob > 0.01 && prob < 0.99
      })
      .map(km => {
        const dbMatch = dbByTicker[km.ticker]
        const prob = kalshiDollarsToProbability(km)
        const eventTicker = km.event_ticker ?? km.ticker
        return {
          ticker: km.ticker,
          event_ticker: eventTicker,
          title: km.title,
          probability: prob,
          volume_24h: km.volume_24h_fp ?? 0,
          open_interest: km.open_interest_fp ?? 0,
          liquidity: parseFloat(km.liquidity_dollars ?? '0') || 0,
          previous_price: parseFloat(km.previous_price_dollars ?? '0') || null,
          db_id: dbMatch?.id ?? null,
          relationship_count: dbMatch ? (relCounts[dbMatch.id] ?? 0) : 0,
          last_updated: dbMatch?.last_updated ?? new Date().toISOString(),
          kalshi_url: `https://kalshi.com/markets/${eventTicker.replace(/-\d{2}[A-Z0-9]*$/i, '').toUpperCase()}`,
        }
      })
      // Sort: by volume first, then relationship count
      .sort((a, b) => {
        const volDiff = b.volume_24h - a.volume_24h
        if (Math.abs(volDiff) > 0.01) return volDiff
        return b.relationship_count - a.relationship_count
      })
      .slice(0, 20)

    return NextResponse.json({
      markets,
      total: markets.length,
      fetched_at: new Date().toISOString(),
      source: 'kalshi_live',
    })
  } catch (err) {
    console.error('[/api/markets/top]', err)
    return NextResponse.json({ markets: [], error: 'Server error', fetched_at: new Date().toISOString() }, { status: 500 })
  }
}
