import { NextResponse } from 'next/server'

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'

// GET /api/markets/kalshi-url?ticker=KXAMEND25-29
// Looks up the market on Kalshi, returns the correct event-level URL.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ url: 'https://kalshi.com' })

  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.KALSHI_API_KEY) {
    authHeaders['Authorization'] = `Bearer ${process.env.KALSHI_API_KEY}`
  }

  try {
    const res = await fetch(`${KALSHI_BASE}/markets/${encodeURIComponent(ticker)}`, {
      headers: authHeaders,
      next: { revalidate: 3600 },
    })

    if (res.ok) {
      const data = await res.json()
      const eventTicker = data.market?.event_ticker
      if (eventTicker) {
        // Strip version suffix (e.g. -29, -26MAR17) from event_ticker too
        const slug = eventTicker.replace(/-\d{2}[A-Z0-9]*$/i, '').toUpperCase()
        return NextResponse.json({ url: `https://kalshi.com/markets/${slug}` })
      }
    }
  } catch { /* fall through */ }

  // Fallback: best-effort from ticker string
  const slug = ticker.replace(/-(?:YES|NO)$/i, '').replace(/-\d{2}[A-Z0-9]*$/i, '').toUpperCase()
  return NextResponse.json({ url: `https://kalshi.com/markets/${slug}` })
}
