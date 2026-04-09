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
    if (idx === -1 || idx + 1 >= segments.length) return null
    // Always take the LAST segment — Kalshi URLs can be:
    //   /markets/TICKER
    //   /markets/EVENT/TICKER
    //   /markets/EVENT/slug-name/TICKER  ← the slug is never the ticker
    const ticker = segments[segments.length - 1]
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
  previous_price_dollars?: string
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

// ── Top markets fetch ─────────────────────────────────────────────────────────

/**
 * Fetches top Kalshi markets for the Market Movers page.
 *
 * Strategy: Fetch multiple pages of open markets in parallel, then sort by
 * 24h trading volume. This is fully dynamic — no hardcoded event list —
 * so it always reflects what's actually trading on Kalshi right now.
 */
export async function fetchTopKalshiMarkets(): Promise<KalshiSingleMarket[]> {
  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.KALSHI_API_KEY) {
    authHeaders['Authorization'] = `Bearer ${process.env.KALSHI_API_KEY}`
  }

  // Fetch 3 pages of 100 open markets in parallel for broad coverage
  const pages = await Promise.all(
    [1, 2, 3].map(async (page) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const params = new URLSearchParams({ status: 'open', limit: '100' })
        if (page > 1) params.set('page_number', String(page))
        const res = await fetch(`${KALSHI_BASE_URL}/markets?${params}`, {
          headers: authHeaders,
          signal: controller.signal,
          next: { revalidate: 300 },
        })
        return res.ok ? ((await res.json()).markets ?? []) as KalshiSingleMarket[] : []
      } catch {
        return [] as KalshiSingleMarket[]
      } finally {
        clearTimeout(timeout)
      }
    })
  )

  const all = pages.flat()

  // Deduplicate by ticker
  const seen = new Set<string>()
  const unique = all.filter(m => {
    if (seen.has(m.ticker)) return false
    seen.add(m.ticker)
    return true
  })

  // Keep only markets with a real price
  const priced = unique.filter(m => {
    const bid = parseFloat(m.yes_bid_dollars ?? '0') || 0
    const last = parseFloat(m.last_price_dollars ?? '0') || 0
    return bid > 0 || last > 0
  })

  // Sort: 24h volume → open interest → price
  return priced.sort((a, b) => {
    const volDiff = (b.volume_24h_fp ?? 0) - (a.volume_24h_fp ?? 0)
    if (Math.abs(volDiff) > 0.0001) return volDiff
    const oiDiff = (b.open_interest_fp ?? 0) - (a.open_interest_fp ?? 0)
    if (Math.abs(oiDiff) > 0.0001) return oiDiff
    const priceA = parseFloat(a.yes_bid_dollars ?? a.last_price_dollars ?? '0') || 0
    const priceB = parseFloat(b.yes_bid_dollars ?? b.last_price_dollars ?? '0') || 0
    return priceB - priceA
  })
}

export function kalshiDollarsToProbability(market: KalshiSingleMarket): number {
  const bid = parseFloat(market.yes_bid_dollars ?? '0') || 0
  const ask = parseFloat(market.yes_ask_dollars ?? '0') || 0
  if (bid > 0 && ask > 0) return (bid + ask) / 2
  return parseFloat(market.last_price_dollars ?? '0') || 0
}
