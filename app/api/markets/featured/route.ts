import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/markets/featured
// Returns markets that have the most CROSS-CATEGORY relationships — i.e.,
// markets where assuming an outcome ripples into genuinely different market
// domains. This ensures featured examples show real cross-market impact,
// not just variants of the same event (like "who else acquires Pinterest").
export async function GET() {
  const supabase = createServiceClient()

  const { data: rels, error } = await supabase
    .from('market_relationships')
    .select(`
      market_a_id,
      market_a:markets!market_relationships_market_a_id_fkey(id, title, category, probability, external_id, source),
      market_b:markets!market_relationships_market_b_id_fkey(id, title, category)
    `)
    .limit(1000)

  if (error || !rels?.length) {
    return NextResponse.json({ markets: [] })
  }

  // Score each market_a by number of relationships where market_b is in a
  // DIFFERENT category — these are the genuine cross-market signals.
  const scores: Record<string, { market: Record<string, unknown>; total: number; cross: number }> = {}

  for (const r of rels) {
    const a = r.market_a as unknown as Record<string, unknown> | null
    const b = r.market_b as unknown as Record<string, unknown> | null
    if (!a || !b) continue

    if (!scores[r.market_a_id]) {
      scores[r.market_a_id] = { market: a, total: 0, cross: 0 }
    }

    scores[r.market_a_id].total++
    if (b.category !== a.category) {
      scores[r.market_a_id].cross++
    }
  }

  // Sort: primary = cross-category count, secondary = total relationships.
  // Markets with zero cross-category relationships (all same-event variants)
  // are deprioritized even if they have many total relationships.
  const ranked = Object.values(scores)
    .filter(s => s.cross > 0)          // must have at least one cross-cat rel
    .sort((a, b) => b.cross - a.cross || b.total - a.total)
    .slice(0, 6)
    .map(s => s.market)

  return NextResponse.json(
    { markets: ranked },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}
