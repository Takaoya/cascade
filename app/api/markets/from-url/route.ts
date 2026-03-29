import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  parseKalshiUrl,
  fetchKalshiMarketByTicker,
  fetchKalshiMarketsByEventTicker,
  kalshiDollarsToProbability,
} from '@/lib/kalshi'

// POST /api/markets/from-url
// Body: { url: string }
// Parses a Kalshi market URL, fetches live data, upserts into DB, returns the market record.
export async function POST(request: Request) {
  const { url } = await request.json()

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  // Step 1: extract ticker from URL
  const ticker = parseKalshiUrl(url)
  if (!ticker) {
    return NextResponse.json(
      { error: 'Not a valid Kalshi market URL. Expected format: kalshi.com/markets/TICKER' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Step 2: check if we already have this market in our DB (skip Kalshi fetch if fresh)
  const { data: existing } = await supabase
    .from('markets')
    .select('*')
    .eq('source', 'kalshi')
    .eq('external_id', ticker)
    .single()

  if (existing) {
    // Check how many mapped relationships exist for this market
    const { count } = await supabase
      .from('market_relationships')
      .select('id', { count: 'exact', head: true })
      .eq('market_a_id', existing.id)

    return NextResponse.json({
      market: existing,
      mapped_relationships: count ?? 0,
      source: 'db',
    })
  }

  // Step 3: market not in DB — fetch live from Kalshi
  // First try direct ticker lookup, then fall back to event ticker search.
  // Kalshi URLs can be either a market ticker (KXTRUMPRESIGN-26) or an event slug (us-iran-nuclear-deal).
  let kalshiMarket = await fetchKalshiMarketByTicker(ticker)
  if (!kalshiMarket) {
    kalshiMarket = await fetchKalshiMarketsByEventTicker(ticker)
  }
  if (!kalshiMarket) {
    return NextResponse.json(
      { error: `No open markets found for "${ticker}" on Kalshi. The market may be closed or the URL may be incorrect.` },
      { status: 404 }
    )
  }

  const probability = kalshiDollarsToProbability(kalshiMarket)

  // Step 4: upsert into DB
  const { data: upserted, error: upsertError } = await supabase
    .from('markets')
    .upsert(
      {
        source: 'kalshi',
        external_id: kalshiMarket.ticker,
        title: kalshiMarket.title,
        probability: Math.min(1, Math.max(0, probability)),
        category: kalshiMarket.event_ticker,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'source,external_id' }
    )
    .select()
    .single()

  if (upsertError || !upserted) {
    return NextResponse.json({ error: upsertError?.message ?? 'Failed to save market' }, { status: 500 })
  }

  return NextResponse.json({
    market: upserted,
    mapped_relationships: 0,
    source: 'kalshi_live',
  })
}
