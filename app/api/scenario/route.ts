import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { computeScenario } from '@/lib/probability'
import type { Market, MarketRelationship } from '@/lib/probability'

// POST /api/scenario
// Body: { assumed_market_id: string, assumed_probability?: number }
export async function POST(request: Request) {
  const body = await request.json()
  const { assumed_market_id, assumed_probability = 1.0, resolves_yes = true } = body

  if (!assumed_market_id) {
    return NextResponse.json({ error: 'assumed_market_id is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch the assumed market
  const { data: assumedMarket, error: marketError } = await supabase
    .from('markets')
    .select('*')
    .eq('id', assumed_market_id)
    .single()

  if (marketError || !assumedMarket) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  // Fetch all relationships where this market is market_a
  const { data: relationships, error: relError } = await supabase
    .from('market_relationships')
    .select('*, market_b:markets!market_relationships_market_b_id_fkey(*)')
    .eq('market_a_id', assumed_market_id)

  if (relError) {
    return NextResponse.json({ error: relError.message }, { status: 500 })
  }

  const relatedMarkets = (relationships ?? []).map((r: any) => ({
    market: r.market_b as Market,
    relationship: {
      id: r.id,
      market_a_id: r.market_a_id,
      market_b_id: r.market_b_id,
      relationship_type: r.relationship_type,
      weight: r.weight,
      notes: r.notes,
    } as MarketRelationship,
  }))

  const results = computeScenario(assumed_probability, relatedMarkets, resolves_yes)

  return NextResponse.json({
    assumed_market: assumedMarket,
    assumed_probability,
    resolves_yes,
    results,
  })
}
