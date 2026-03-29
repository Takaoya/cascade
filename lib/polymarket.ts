// Polymarket CLOB API client
// Docs: https://docs.polymarket.com

const POLYMARKET_BASE_URL = 'https://clob.polymarket.com'
const GAMMA_BASE_URL = 'https://gamma-api.polymarket.com'

interface PolymarketMarket {
  condition_id: string
  question: string
  outcomePrices: string // JSON array e.g. "[0.72, 0.28]"
  outcomes: string     // JSON array e.g. '["Yes","No"]'
  category: string
  end_date_iso: string
  active: boolean
}

interface PolymarketMarketsResponse {
  data: PolymarketMarket[]
  next_cursor?: string
}

export async function fetchPolymarkets(category?: string, limit = 100): Promise<PolymarketMarket[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    active: 'true',
    closed: 'false',
  })
  if (category) params.set('tag_slug', category)

  const res = await fetch(`${GAMMA_BASE_URL}/markets?${params}`, {
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    throw new Error(`Polymarket API error: ${res.status} ${res.statusText}`)
  }

  const data: PolymarketMarketsResponse = await res.json()
  return data.data ?? []
}

export function polymarketToProbability(market: PolymarketMarket): number {
  try {
    const prices: number[] = JSON.parse(market.outcomePrices)
    // First outcome is typically "Yes"
    return prices[0] ?? 0.5
  } catch {
    return 0.5
  }
}
