import { NextResponse } from 'next/server'

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'

// GET /api/markets/history?ticker=TICKER
// 1. Looks up the market to get its real event_ticker
// 2. Extracts series (first hyphen segment)
// 3. Fetches candlestick history (daily candles, last 90 days)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')

  if (!ticker) {
    return NextResponse.json({ prices: [] }, { status: 400 })
  }

  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.KALSHI_API_KEY) {
    authHeaders['Authorization'] = `Bearer ${process.env.KALSHI_API_KEY}`
  }

  try {
    // Step 1: Look up the market to get the correct event_ticker
    const mktRes = await fetch(`${KALSHI_BASE}/markets/${encodeURIComponent(ticker)}`, {
      headers: authHeaders,
      next: { revalidate: 3600 },
    })

    let eventTicker = searchParams.get('event_ticker') ?? ticker
    if (mktRes.ok) {
      const mktData = await mktRes.json()
      eventTicker = mktData.market?.event_ticker ?? eventTicker
    }

    // Step 2: series = first hyphen segment of event_ticker
    const seriesTicker = eventTicker.split('-')[0]

    const now = Math.floor(Date.now() / 1000)
    // Use daily candles (1440 min) for last 90 days — enough for a meaningful sparkline
    const ninetyDaysAgo = now - 90 * 24 * 3600

    // Step 3: Fetch candlesticks
    const cdRes = await fetch(
      `${KALSHI_BASE}/series/${seriesTicker}/markets/${ticker}/candlesticks` +
      `?period_interval=1440&start_ts=${ninetyDaysAgo}&end_ts=${now}`,
      { headers: authHeaders, next: { revalidate: 300 } }
    )

    if (!cdRes.ok) {
      return NextResponse.json({ prices: [], debug: `candlestick ${cdRes.status}` })
    }

    const data = await cdRes.json()
    const candles: Record<string, unknown>[] = data.candlesticks ?? []

    if (candles.length === 0) {
      // Try hourly as fallback (shorter window so fewer candles needed)
      const hrRes = await fetch(
        `${KALSHI_BASE}/series/${seriesTicker}/markets/${ticker}/candlesticks` +
        `?period_interval=60&start_ts=${now - 7 * 24 * 3600}&end_ts=${now}`,
        { headers: authHeaders, next: { revalidate: 300 } }
      )
      if (hrRes.ok) {
        const hrData = await hrRes.json()
        candles.push(...(hrData.candlesticks ?? []))
      }
    }

    if (candles.length === 0) {
      return NextResponse.json({ prices: [], series: seriesTicker })
    }

    // Extract close yes-price — Kalshi candles nest as { close: { yes_price: 0.245 } }
    // or flat { yes_price: 24.5 } (cents)
    const prices = candles.map(c => {
      const closeObj = c.close as Record<string, unknown> | undefined
      const raw =
        closeObj?.yes_price ??
        c.yes_price ??
        closeObj?.price ??
        c.price ??
        null
      if (raw === null || raw === undefined) return null
      const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
      if (isNaN(num)) return null
      return num > 1 ? num / 100 : num  // normalise cents → fraction
    }).filter((p): p is number => p !== null)

    return NextResponse.json({ prices, count: prices.length, series: seriesTicker })
  } catch (err) {
    return NextResponse.json({ prices: [], error: String(err) })
  }
}
