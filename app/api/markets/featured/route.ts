import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/markets/featured
// Returns markets that have the most mapped relationships — guaranteed to
// produce results when used as scenario examples.
export async function GET() {
  const supabase = createServiceClient()

  // Pull all relationship source markets (market_a_id) ordered by weight
  // so high-confidence relationships surface first.
  const { data: rels, error: relError } = await supabase
    .from('market_relationships')
    .select('market_a_id')
    .order('weight', { ascending: false })
    .limit(500)

  if (relError || !rels?.length) {
    return NextResponse.json({ markets: [] })
  }

  // Count how many relationships each market_a has
  const counts: Record<string, number> = {}
  for (const r of rels) {
    counts[r.market_a_id] = (counts[r.market_a_id] ?? 0) + 1
  }

  // Take the 6 markets with the most relationships
  const topIds = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id)

  const { data: markets, error: mktError } = await supabase
    .from('markets')
    .select('*')
    .in('id', topIds)

  if (mktError) {
    return NextResponse.json({ error: mktError.message }, { status: 500 })
  }

  // Re-sort to match the relationship-count order
  const sorted = topIds
    .map(id => markets?.find(m => m.id === id))
    .filter(Boolean)

  return NextResponse.json(
    { markets: sorted },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}
