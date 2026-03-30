import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/markets/top
// Reads top markets directly from our Supabase DB — no live Kalshi calls,
// so this is fast and reliable. Prices reflect the last seed/sync run.
export async function GET() {
  try {
    const supabase = createServiceClient()

    // Fetch all our curated markets
    const { data: markets, error } = await supabase
      .from('markets')
      .select('id, external_id, title, probability, category, source, last_updated')
      .eq('source', 'kalshi')
      .order('probability', { ascending: false })

    if (error) {
      return NextResponse.json({ markets: [], error: error.message, fetched_at: new Date().toISOString() }, { status: 500 })
    }

    if (!markets || markets.length === 0) {
      return NextResponse.json({ markets: [], error: 'No markets in database', fetched_at: new Date().toISOString() })
    }

    // Get relationship counts for all markets
    const { data: rels } = await supabase
      .from('market_relationships')
      .select('market_a_id')

    const relCounts: Record<string, number> = {}
    ;(rels ?? []).forEach(r => {
      relCounts[r.market_a_id] = (relCounts[r.market_a_id] ?? 0) + 1
    })

    const scored = markets
      // Filter out near-certain markets (already resolved / no trading edge)
      .filter(m => m.probability > 0.01 && m.probability < 0.99)
      .map(m => ({
        ticker: m.external_id,
        event_ticker: m.category,
        title: m.title,
        probability: m.probability,
        volume_24h: 0,
        open_interest: 0,
        liquidity: 0,
        db_id: m.id,
        relationship_count: relCounts[m.id] ?? 0,
        last_updated: m.last_updated,
      }))
      // Sort: mapped markets first, then by distance from 50% (most uncertain = most interesting)
      .sort((a, b) => {
        const relDiff = b.relationship_count - a.relationship_count
        if (relDiff !== 0) return relDiff
        // Closer to 50% = more uncertain = more interesting
        return Math.abs(a.probability - 0.5) - Math.abs(b.probability - 0.5)
      })

    return NextResponse.json({
      markets: scored.slice(0, 10),
      total: markets.length,
      fetched_at: new Date().toISOString(),
      source: 'db',
    })
  } catch (err) {
    console.error('[/api/markets/top]', err)
    return NextResponse.json({ markets: [], error: 'Server error', fetched_at: new Date().toISOString() }, { status: 500 })
  }
}
