// Kalshi REST API client
// Docs: https://trading-api.kalshi.com/trade-api/v2

const KALSHI_BASE_URL = 'https://trading-api.kalshi.com/trade-api/v2'

interface KalshiMarket {
  ticker: string
  title: string
  yes_bid: number
  yes_ask: number
  last_price: number
  category: string
  close_time: string
  status: string
}

interface KalshiMarketsResponse {
  markets: KalshiMarket[]
  cursor?: string
}

export async function fetchKalshiMarkets(category?: string, limit = 100): Promise<KalshiMarket[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (category) params.set('category', category)

  const res = await fetch(`${KALSHI_BASE_URL}/markets?${params}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.KALSHI_API_KEY
        ? { Authorization: `Bearer ${process.env.KALSHI_API_KEY}` }
        : {}),
    },
    next: { revalidate: 300 }, // cache 5 minutes
  })

  if (!res.ok) {
    throw new Error(`Kalshi API error: ${res.status} ${res.statusText}`)
  }

  const data: KalshiMarketsResponse = await res.json()
  return data.markets ?? []
}

export function kalshiMarketToProbability(market: KalshiMarket): number {
  // Use midpoint of bid/ask, fall back to last_price
  if (market.yes_bid != null && market.yes_ask != null) {
    return (market.yes_bid + market.yes_ask) / 2 / 100
  }
  return (market.last_price ?? 50) / 100
}
