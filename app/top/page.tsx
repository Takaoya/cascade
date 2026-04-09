'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { ScenarioResult } from '@/lib/probability'
import { formatProbability } from '@/lib/probability'

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ prices, color = '#22c55e' }: { prices: number[]; color?: string }) {
  if (prices.length < 2) return null
  const W = 300
  const H = 48
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 0.01
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W
    const y = H - ((p - min) / range) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const polyline = pts.join(' ')
  const last = prices[prices.length - 1]
  const first = prices[0]
  const isUp = last >= first
  const lineColor = isUp ? '#22c55e' : '#ef4444'
  const fillId = `fill-${Math.random().toString(36).slice(2)}`

  // Close path for gradient fill
  const fillPath = `M ${pts[0]} L ${pts.join(' L ')} L ${W},${H} L 0,${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-12">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${fillId})`} />
      <polyline points={polyline} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Current price dot */}
      <circle cx={W} cy={parseFloat(pts[pts.length - 1].split(',')[1])} r="2.5" fill={lineColor} />
    </svg>
  )
}

function SparklineLoader({ ticker, eventTicker, fallbackPrices }: {
  ticker: string
  eventTicker: string
  fallbackPrices?: number[]
}) {
  const [prices, setPrices] = useState<number[]>(fallbackPrices ?? [])
  const [fetching, setFetching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetching) {
        setFetching(true)
        fetch(`/api/markets/history?ticker=${encodeURIComponent(ticker)}&event_ticker=${encodeURIComponent(eventTicker)}`)
          .then(r => r.json())
          .then(d => {
            if ((d.prices ?? []).length >= 2) setPrices(d.prices)
            // else keep fallback
          })
          .catch(() => {})
      }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [ticker, eventTicker, fetching])

  return (
    <div ref={ref} className="w-full">
      {prices.length >= 2 ? (
        <Sparkline prices={prices} />
      ) : (
        <div className="w-full h-12 bg-slate-50 dark:bg-white/[0.02] rounded-lg" />
      )}
    </div>
  )
}

interface TopMarket {
  ticker: string
  event_ticker: string
  title: string
  probability: number
  volume_24h: number
  open_interest: number
  liquidity: number
  db_id: string | null
  relationship_count: number
  last_updated?: string
  kalshi_url?: string
  previous_price: number | null
}

interface Headline {
  title: string
  url: string
  source: string
  publishedAt: string
}

function getMarketTheme(ticker: string, title: string) {
  const t = (ticker + title).toLowerCase()
  if (t.includes('trump') || t.includes('president') || t.includes('resign') || t.includes('impeach') || t.includes('cabinet'))
    return { gradient: 'from-red-500/10 to-transparent', accent: 'text-red-400', border: 'border-red-500/20', icon: '🏛️' }
  if (t.includes('fed') || t.includes('rate') || t.includes('gdp') || t.includes('inflation') || t.includes('economy') || t.includes('debt'))
    return { gradient: 'from-emerald-500/10 to-transparent', accent: 'text-emerald-400', border: 'border-emerald-500/20', icon: '📈' }
  if (t.includes('china') || t.includes('taiwan') || t.includes('trade') || t.includes('tariff'))
    return { gradient: 'from-amber-500/10 to-transparent', accent: 'text-amber-400', border: 'border-amber-500/20', icon: '🌐' }
  if (t.includes('war') || t.includes('ukraine') || t.includes('russia') || t.includes('iran') || t.includes('nuclear') || t.includes('military'))
    return { gradient: 'from-orange-500/10 to-transparent', accent: 'text-orange-400', border: 'border-orange-500/20', icon: '⚔️' }
  if (t.includes('election') || t.includes('senate') || t.includes('house') || t.includes('congress') || t.includes('vote'))
    return { gradient: 'from-blue-500/10 to-transparent', accent: 'text-blue-400', border: 'border-blue-500/20', icon: '🗳️' }
  if (t.includes('kim') || t.includes('korea') || t.includes('canal') || t.includes('territory') || t.includes('greenland'))
    return { gradient: 'from-green-500/10 to-transparent', accent: 'text-green-400', border: 'border-green-500/20', icon: '🌍' }
  return { gradient: 'from-slate-500/10 to-transparent', accent: 'text-green-400', border: 'border-green-500/20', icon: '📊' }
}

function formatVolume(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`
  if (v > 0) return `$${v.toFixed(0)}`
  return '—'
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function TopMarketsPage() {
  const [markets, setMarkets] = useState<TopMarket[]>([])
  const [headlines, setHeadlines] = useState<Headline[]>([])
  const [loading, setLoading] = useState(true)
  const [newsLoading, setNewsLoading] = useState(true)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cascades, setCascades] = useState<Record<string, ScenarioResult[]>>({})
  const [cascadeLoading, setCascadeLoading] = useState<Record<string, boolean>>({})
  const [countdown, setCountdown] = useState(60)

  const fetchMarkets = useCallback(async () => {
    try {
      const d = await fetch('/api/markets/top').then(r => r.json())
      if (d.error && !d.markets?.length) setError(d.error)
      else { setMarkets(d.markets ?? []); setFetchedAt(d.fetched_at ?? null) }
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [])

  const fetchNews = useCallback(async () => {
    try {
      const d = await fetch('/api/news').then(r => r.json())
      setHeadlines(d.headlines ?? [])
    } catch { /* silent */ }
    finally { setNewsLoading(false) }
  }, [])

  // Initial load
  useEffect(() => { fetchMarkets(); fetchNews() }, [fetchMarkets, fetchNews])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchMarkets()
          return 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [fetchMarkets])

  const toggleExpand = async (market: TopMarket) => {
    const key = market.ticker
    if (expandedId === key) { setExpandedId(null); return }
    setExpandedId(key)
    if (!market.db_id || market.relationship_count === 0) return
    if (cascades[key]) return
    setCascadeLoading(prev => ({ ...prev, [key]: true }))
    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assumed_market_id: market.db_id, assumed_probability: 1.0, resolves_yes: true }),
      })
      const data = await res.json()
      setCascades(prev => ({ ...prev, [key]: data.results ?? [] }))
    } finally {
      setCascadeLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  return (
    <div className="min-h-screen bg-[#f7fdf7] dark:bg-[#050505] text-slate-800 dark:text-white font-sans transition-colors">

      {/* Nav */}
      <header className="border-b border-slate-200 dark:border-white/[0.06] px-6 py-3.5 flex items-center justify-between bg-white/80 dark:bg-black/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-black tracking-[0.2em] uppercase text-slate-900 dark:text-white">CASCADE</Link>
          <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/25 uppercase tracking-widest font-bold">Beta</span>
        </div>
        <nav className="flex items-center gap-5">
          <span className="text-xs font-bold text-slate-800 dark:text-white relative after:absolute after:-bottom-0.5 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-green-500 after:to-emerald-500">
            Market Pulse
          </span>
          <Link href="/scenario" className="text-xs text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white transition-colors">Scenario Builder →</Link>
        </nav>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[11px] uppercase tracking-widest text-green-600 dark:text-green-400 font-bold">Live · Kalshi</p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">Market Pulse</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Volume-ranked markets + breaking news — click any to cascade</p>
            </div>
            {/* Refresh countdown */}
            <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-white/30">
              <span>Refreshes in <span className="font-mono font-bold text-green-600 dark:text-green-400">{countdown}s</span></span>
              <button onClick={() => { fetchMarkets(); setCountdown(60) }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:border-green-400 dark:hover:border-green-500/40 text-slate-500 dark:text-white/40 hover:text-green-600 dark:hover:text-green-400 transition-all text-[11px] font-semibold">
                ↻ Refresh
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <div className="w-8 h-8 border-2 border-slate-200 dark:border-white/10 border-t-green-500 rounded-full animate-spin" />
            <p className="text-xs text-slate-400 dark:text-white/30 tracking-widest uppercase">Loading markets…</p>
          </div>
        ) : error && markets.length === 0 ? (
          <div className="text-center py-40">
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── LEFT: Breaking News ── */}
            <div className="lg:w-80 xl:w-96 shrink-0">
              <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden sticky top-20">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-widest">Breaking</p>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-white/25 font-medium">Click → Analyze</span>
                </div>

                {newsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-slate-200 dark:border-white/10 border-t-green-500 rounded-full animate-spin" />
                  </div>
                ) : headlines.length === 0 ? (
                  <p className="text-slate-400 dark:text-white/25 text-xs text-center py-8 px-4">No headlines available</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/[0.04] max-h-[600px] overflow-y-auto">
                    {headlines.map((h, i) => (
                      <Link key={i}
                        href={`/scenario?q=${encodeURIComponent(h.title.slice(0, 60))}`}
                        className="block px-4 py-3.5 hover:bg-green-50 dark:hover:bg-white/[0.04] transition-colors group">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-white/40 uppercase tracking-widest">
                            {h.source}
                          </span>
                          <span className="text-[9px] text-slate-300 dark:text-white/20">{timeAgo(h.publishedAt)}</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-white/70 group-hover:text-green-700 dark:group-hover:text-white leading-snug line-clamp-2 transition-colors">
                          {h.title}
                        </p>
                        <p className="text-[10px] text-green-600 dark:text-green-400 mt-1.5 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          → Analyze in Cascade
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: Volume-ranked markets ── */}
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
                {markets.map((market, i) => (
                  <MarketCard
                    key={market.ticker}
                    market={market}
                    rank={i + 1}
                    isExpanded={expandedId === market.ticker}
                    onToggle={() => toggleExpand(market)}
                    cascade={cascades[market.ticker] ?? null}
                    cascadeLoading={cascadeLoading[market.ticker] ?? false}
                  />
                ))}
              </div>

              {!loading && markets.length > 0 && (
                <div className="mt-6 flex items-center gap-6 text-[10px] text-slate-400 dark:text-white/20 font-medium">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Underpriced → BUY YES</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" /> Overpriced → BUY NO</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Ranked by 24h volume</span>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

// ── Market Card ────────────────────────────────────────────────────────────────
function MarketCard({ market, rank, isExpanded, onToggle, cascade, cascadeLoading: cLoading }: {
  market: TopMarket; rank: number; isExpanded: boolean; onToggle: () => void
  cascade: ScenarioResult[] | null; cascadeLoading: boolean
}) {
  const theme = getMarketTheme(market.event_ticker, market.title)
  const prob = market.probability
  const hasCascade = market.db_id && market.relationship_count > 0
  const isHot = market.volume_24h > 50000

  const probColor = prob >= 0.65 ? 'text-emerald-600 dark:text-emerald-400' : prob <= 0.35 ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-white'
  const barColor = prob >= 0.65 ? 'bg-emerald-500' : prob <= 0.35 ? 'bg-red-500' : 'bg-green-500'

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col transition-all hover:shadow-md bg-white dark:bg-white/[0.02] ${
      isExpanded
        ? 'border-green-400/60 dark:border-green-500/30 shadow-green-500/10 dark:shadow-green-500/5'
        : 'border-slate-200 dark:border-white/[0.07] hover:border-green-300 dark:hover:border-white/[0.12]'
    }`}>

      {/* Top strip */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${theme.gradient} opacity-80`} />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
              rank <= 3 ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-white/30'
            }`}>{rank}</span>
            <span className="text-lg">{theme.icon}</span>
            {isHot && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/25 uppercase tracking-widest">
                🔥 Hot
              </span>
            )}
          </div>
          {/* Volume badge */}
          <div className="text-right shrink-0">
            <p className="text-sm font-black font-mono text-green-600 dark:text-green-400">{formatVolume(market.volume_24h)}</p>
            <p className="text-[9px] text-slate-400 dark:text-white/25 uppercase tracking-widest">24h vol</p>
          </div>
        </div>

        {/* Probability */}
        <div>
          <p className={`text-2xl font-black font-mono ${probColor}`}>{formatProbability(prob)}</p>
          <div className="mt-1.5 h-1 w-full bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${prob * 100}%`, opacity: 0.8 }} />
          </div>
        </div>

        {/* Sparkline */}
        <SparklineLoader
          ticker={market.ticker}
          eventTicker={market.event_ticker}
          fallbackPrices={
            market.previous_price !== null
              ? [market.previous_price, market.probability]
              : undefined
          }
        />

        {/* Title */}
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-white/80 leading-snug line-clamp-2">{market.title}</p>
          <p className={`text-[10px] font-mono uppercase mt-0.5 ${theme.accent} opacity-60`}>{market.event_ticker}</p>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2">
          {market.kalshi_url && (
            <a href={market.kalshi_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-slate-500 dark:text-white/40 bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.07] border border-slate-200 dark:border-white/[0.07] rounded-xl transition-all">
              View on Kalshi
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
          <button onClick={onToggle}
            className={`flex items-center gap-1.5 py-2 px-3 text-[11px] font-bold rounded-xl border transition-all ${
              hasCascade
                ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/25 hover:bg-green-100 dark:hover:bg-green-500/20'
                : 'text-slate-300 dark:text-white/20 bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.05] cursor-default'
            }`}>
            {hasCascade ? (
              <>
                Cascade
                <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            ) : 'Unmapped'}
          </button>
        </div>
      </div>

      {/* Cascade panel */}
      {isExpanded && hasCascade && (
        <div className="border-t border-slate-100 dark:border-white/[0.05] p-4 space-y-2 bg-slate-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/25 font-semibold">Cascade signals — if YES</p>
            <Link href="/scenario" className="text-[10px] text-green-600 dark:text-green-400 hover:text-green-700 font-semibold transition-colors">Full Analysis →</Link>
          </div>

          {cLoading ? (
            <div className="flex items-center gap-2 py-3">
              <div className="w-4 h-4 border-2 border-slate-200 dark:border-white/10 border-t-green-500 rounded-full animate-spin" />
              <span className="text-xs text-slate-400 dark:text-white/25">Computing…</span>
            </div>
          ) : cascade === null ? (
            <p className="text-xs text-slate-400 dark:text-white/25 py-2">Loading…</p>
          ) : cascade.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-white/25 py-2">No correlated markets found.</p>
          ) : (
            <div className="space-y-1.5">
              {cascade.slice(0, 4).map(result => {
                const isUp = result.direction === 'up'
                const isDown = result.direction === 'down'
                return (
                  <div key={result.market.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                      isUp ? 'bg-emerald-50 dark:bg-emerald-500/[0.06] border-emerald-200 dark:border-emerald-500/15' :
                      isDown ? 'bg-red-50 dark:bg-red-500/[0.06] border-red-200 dark:border-red-500/15' :
                      'bg-slate-100 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06]'
                    }`}>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border shrink-0 tracking-widest ${
                      isUp ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25' :
                      isDown ? 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25' :
                      'bg-slate-200 dark:bg-white/[0.04] text-slate-500 dark:text-white/30 border-slate-300 dark:border-white/10'
                    }`}>{isUp ? 'BUY YES' : isDown ? 'BUY NO' : 'HOLD'}</span>
                    <p className="flex-1 text-[11px] leading-snug line-clamp-1 text-slate-600 dark:text-white/60">{result.market.title}</p>
                    <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                      <span className="text-slate-400 dark:text-white/25">{formatProbability(result.current_probability)}</span>
                      <span className="text-slate-300 dark:text-white/15">→</span>
                      <span className={`font-black ${isUp ? 'text-emerald-600 dark:text-emerald-400' : isDown ? 'text-red-500 dark:text-red-400' : 'text-slate-400'}`}>
                        {formatProbability(result.implied_probability)}
                      </span>
                    </div>
                  </div>
                )
              })}
              {cascade.length > 4 && (
                <Link href="/scenario" className="block w-full text-center text-[10px] text-slate-400 dark:text-white/25 hover:text-green-600 dark:hover:text-green-400 py-1.5 transition-colors">
                  +{cascade.length - 4} more → Full Analysis
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
