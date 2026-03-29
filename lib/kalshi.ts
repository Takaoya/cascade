// Kalshi REST API client
// Docs: https://trading-api.kalshi.com/trade-api/v2

const KALSHI_BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2'

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

// ── URL parsing ───────────────────────────────────────────────────────────────

/**
 * Extracts a Kalshi market ticker from a Kalshi URL.
 * Handles formats like:
 *   https://kalshi.com/markets/KXTRUMPRESIGN-26
 *   https://kalshi.com/markets/KXBTCD-25JAN17/KXBTCD-25JAN17-T23000
 */
export function parseKalshiUrl(input: string): string | null {
  try {
    const url = new URL(input.trim())
    if (!url.hostname.includes('kalshi.com')) return null
    const segments = url.pathname.split('/').filter(Boolean)
    const idx = segments.indexOf('markets')
    if (idx === -1) return null
    // Prefer the deeper segment (specific market over event), fall back to the one right after 'markets'
    const ticker = segments[idx + 2] || segments[idx + 1]
    return ticker?.toUpperCase() || null
  } catch {
    return null
  }
}

// ── Single-market lookup ──────────────────────────────────────────────────────

export interface KalshiSingleMarket {
  ticker: string
  event_ticker: string
  title: string
  yes_bid_dollars?: string
  yes_ask_dollars?: string
  last_price_dollars?: string
  volume_24h_fp?: number
  open_interest_fp?: number
  liquidity_dollars?: string
  status: string
}

/**
 * Fetches a single market by ticker from the Kalshi API.
 * Returns null if the market doesn't exist or the request fails.
 */
export async function fetchKalshiMarketByTicker(ticker: string): Promise<KalshiSingleMarket | null> {
  const res = await fetch(`${KALSHI_BASE_URL}/markets/${encodeURIComponent(ticker)}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.KALSHI_API_KEY
        ? { Authorization: `Bearer ${process.env.KALSHI_API_KEY}` }
        : {}),
    },
    next: { revalidate: 60 },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.market ?? null
}

/**
 * When a direct ticker lookup fails, try fetching open markets under that event ticker.
 * Kalshi event URLs (e.g. kalshi.com/markets/us-iran-nuclear-deal) use slugs that map to event tickers.
 * Returns the first open market found, or null.
 */
export async function fetchKalshiMarketsByEventTicker(eventTicker: string): Promise<KalshiSingleMarket | null> {
  const res = await fetch(
    `${KALSHI_BASE_URL}/markets?event_ticker=${encodeURIComponent(eventTicker)}&status=open&limit=1`,
    {
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.KALSHI_API_KEY
          ? { Authorization: `Bearer ${process.env.KALSHI_API_KEY}` }
          : {}),
      },
      next: { revalidate: 60 },
    }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.markets?.[0] ?? null
}

// ── Batch fetch for top-markets feature ──────────────────────────────────────

const TARGET_EVENTS = [
  'KXTRUMPRESIGN','KXIMPEACH-29','KXTRUMPREMOVE','KXINSURRECTION-29',
  'KXFEDEND-29','KXDOED-29','KXHABEAS-29','KXMARTIAL-29JAN20',
  'KXAMEND25-29','KXCABOUT-26MAR','KXFTAPRC-29','KXFTA-29',
  'KXBALANCE-29','KXDEBTGROWTH-28DEC31','KXGOVTCUTS-28','KXGDPUSMAX-28',
  'KXGDPSHAREMANU-29','CHINAUSGDP','KXU3MAX-30','KXCANAL-29',
  'KXGREENTERRITORY-29','KXCANTERRITORY-29','KXSTATE-29','KXTAIWANLVL4',
  'KXRECOGROC-29','KXZELENSKYPUTIN-29','KXUSAKIM-29','KXABRAHAMSA-29',
  'KXABRAHAMSY-29','KXPRESPARTY-2028','KXPRESPERSON-28','POWER-28',
]

/**
 * Fetches all open markets across our curated political/economic event tickers in parallel.
 * Returns a flat list sorted by 24h volume descending.
 */
export async function fetchAllCuratedMarkets(): Promise<KalshiSingleMarket[]> {
  const authHeaders = {
    'Content-Type': 'application/json',
    ...(process.env.KALSHI_API_KEY ? { Authorization: `Bearer ${process.env.KALSHI_API_KEY}` } : {}),
  }

  const results = await Promise.all(
    TARGET_EVENTS.map(event =>
      fetch(`${KALSHI_BASE_URL}/markets?event_ticker=${event}&status=open&limit=10`, {
        headers: authHeaders,
        next: { revalidate: 300 },
      })
        .then(r => r.ok ? r.json() : { markets: [] })
        .then((d: { markets?: KalshiSingleMarket[] }) => d.markets ?? [])
        .catch(() => [] as KalshiSingleMarket[])
    )
  )

  return results
    .flat()
    .sort((a, b) => (b.volume_24h_fp ?? 0) - (a.volume_24h_fp ?? 0))
}

export function kalshiDollarsToProbability(market: KalshiSingleMarket): number {
  const bid = parseFloat(market.yes_bid_dollars ?? '0') || 0
  const ask = parseFloat(market.yes_ask_dollars ?? '0') || 0
  if (bid > 0 && ask > 0) return (bid + ask) / 2
  return parseFloat(market.last_price_dollars ?? '0') || 0
}
