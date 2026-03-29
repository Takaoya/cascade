import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fetchKalshiMarkets, kalshiMarketToProbability } from '@/lib/kalshi'
import { fetchPolymarkets, polymarketToProbability } from '@/lib/polymarket'

// GET /api/markets?q=trump&source=kalshi
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') ?? ''
  const source = searchParams.get('source') // optional filter

  const supabase = createServiceClient()

  let dbQuery = supabase
    .from('markets')
    .select('*')
    .order('last_updated', { ascending: false })
    .limit(50)

  if (query) {
    dbQuery = dbQuery.ilike('title', `%${query}%`)
  }
  if (source) {
    dbQuery = dbQuery.eq('source', source)
  }

  const { data, error } = await dbQuery

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ markets: data })
}

// POST /api/markets/sync — syncs latest prices from Kalshi + Polymarket into DB
export async function POST() {
  const supabase = createServiceClient()

  try {
    const [kalshiMarkets, polyMarkets] = await Promise.all([
      fetchKalshiMarkets(),
      fetchPolymarkets(),
    ])

    const upserts = [
      ...kalshiMarkets.map((m) => ({
        source: 'kalshi' as const,
        external_id: m.ticker,
        title: m.title,
        probability: kalshiMarketToProbability(m),
        category: m.category ?? null,
        last_updated: new Date().toISOString(),
      })),
      ...polyMarkets.map((m) => ({
        source: 'polymarket' as const,
        external_id: m.condition_id,
        title: m.question,
        probability: polymarketToProbability(m),
        category: m.category ?? null,
        last_updated: new Date().toISOString(),
      })),
    ]

    const { error } = await supabase
      .from('markets')
      .upsert(upserts, { onConflict: 'source,external_id' })

    if (error) throw error

    return NextResponse.json({ synced: upserts.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
