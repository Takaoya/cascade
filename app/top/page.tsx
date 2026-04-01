'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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
}

import type { ScenarioResult } from '@/lib/probability'
import { formatProbability, formatDistortion } from '@/lib/probability'

export default function TopMarketsPage() {
  const [markets, setMarkets] = useState<TopMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cascades, setCascades] = useState<Record<string, ScenarioResult[]>>({})
  const [cascadeLoading, setCascadeLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/markets/top')
      .then(r => r.json())
      .then(d => {
        if (d.error && !d.markets?.length) {
          setError(d.error)
        } else {
          setMarkets(d.markets ?? [])
          setFetchedAt(d.fetched_at ?? null)
        }
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

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
    <div className="min-h-screen bg-[#060a0f] text-zinc-100 font-sans">

      {/* Nav */}
      <header className="border-b border-slate-800/60 px-6 py-3 flex items-center justify-between bg-[#060a0f]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-black tracking-[0.2em] uppercase bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
            Cascade
          </Link>
          <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-violet-500/15 text-violet-400 border border-violet-500/25 uppercase tracking-widest font-bold">Beta</span>
        </div>
        <nav className="flex items-center gap-6">
          <span className="text-xs font-bold text-white relative after:absolute after:-bottom-0.5 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-violet-500 after:to-cyan-500">
            Market Movers
          </span>
          <Link href="/scenario" className="text-xs text-slate-500 hover:text-white transition-colors">Scenario Builder →</Link>
        </nav>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-widest text-violet-400 mb-2 font-bold">Kalshi · Political Markets</p>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Market Movers
              </h1>
              <p className="text-slate-500 text-sm mt-1.5">Top 10 most-correlated markets — click any row to see cascade signals</p>
            </div>
            {fetchedAt && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Live · {new Date(fetchedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-8 h-8 border-2 border-slate-800 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-xs text-slate-600 tracking-wide">Loading markets…</p>
          </div>
        ) : error || markets.length === 0 ? (
          <div className="text-center py-32 space-y-3">
            <p className="text-slate-400 text-sm">{error ?? 'No markets found.'}</p>
            <p className="text-slate-700 text-xs">Run <code className="text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">npm run seed</code> locally to populate the database.</p>
          </div>
        ) : (
          <div className="border border-slate-800/60 rounded-2xl overflow-hidden">

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-800/60 bg-slate-900/40">
              <div className="col-span-1 text-[10px] uppercase tracking-widest text-slate-600 font-semibold">#</div>
              <div className="col-span-5 text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Market</div>
              <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Price</div>
              <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-slate-600 font-semibold">24h Vol</div>
              <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Signals</div>
            </div>

            {markets.map((market, i) => (
              <TopMarketRow
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
        )}

        {/* Legend */}
        {!loading && markets.length > 0 && (
          <div className="mt-5 flex items-center gap-6 text-[10px] text-slate-700 font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Underpriced → BUY YES</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Overpriced → BUY NO</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> Signals = mapped correlations</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Top market row ─────────────────────────────────────────────────────────────

function TopMarketRow({
  market, rank, isExpanded, onToggle, cascade, cascadeLoading,
}: {
  market: TopMarket
  rank: number
  isExpanded: boolean
  onToggle: () => void
  cascade: ScenarioResult[] | null
  cascadeLoading: boolean
}) {
  const prob = market.probability
  const vol = market.volume_24h
  const hasCascade = market.db_id && market.relationship_count > 0

  const volStr = vol > 0
    ? vol >= 1000 ? `$${(vol / 1000).toFixed(1)}k` : `$${vol.toFixed(0)}`
    : '—'

  // Color the probability based on position
  const probColor = prob >= 0.7 ? 'text-emerald-400' : prob <= 0.3 ? 'text-red-400' : 'text-white'
  const barColor = prob >= 0.7 ? 'bg-emerald-500' : prob <= 0.3 ? 'bg-red-500' : 'bg-violet-500'

  return (
    <div className={`border-b border-slate-800/30 last:border-b-0 transition-all ${
      isExpanded ? 'bg-slate-900/30' : 'hover:bg-slate-900/20'
    }`}>

      {/* Main row */}
      <button onClick={onToggle} className="w-full grid grid-cols-12 gap-3 px-5 py-4 text-left items-center">

        {/* Rank */}
        <div className="col-span-1">
          <span className={`text-sm font-black font-mono ${rank <= 3 ? 'bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent' : 'text-slate-600'}`}>
            {rank}
          </span>
        </div>

        {/* Title */}
        <div className="col-span-5">
          <p className="text-sm text-slate-200 leading-snug line-clamp-2 group-hover:text-white">{market.title}</p>
          <p className="text-[10px] text-slate-700 mt-0.5 uppercase font-mono tracking-wide">{market.event_ticker}</p>
        </div>

        {/* Price */}
        <div className="col-span-2 flex flex-col items-end gap-1.5">
          <span className={`text-sm font-mono font-black ${probColor}`}>{formatProbability(prob)}</span>
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full opacity-60 transition-all`} style={{ width: `${prob * 100}%` }} />
          </div>
        </div>

        {/* 24h Volume */}
        <div className="col-span-2 text-right">
          <span className={`text-sm font-mono ${vol > 0 ? 'text-slate-200 font-bold' : 'text-slate-700'}`}>{volStr}</span>
        </div>

        {/* Signals badge */}
        <div className="col-span-2 flex items-center justify-end gap-2">
          {hasCascade ? (
            <span className="text-xs font-black px-3 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25 tracking-wide"
              style={{ boxShadow: '0 0 12px rgba(139,92,246,0.15)' }}>
              {market.relationship_count} signals
            </span>
          ) : market.db_id ? (
            <span className="text-[10px] text-slate-600 px-2.5 py-1 rounded-full border border-slate-800/60 font-medium">unmapped</span>
          ) : (
            <span className="text-[10px] text-slate-700">—</span>
          )}
          <svg className={`w-3 h-3 text-slate-600 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-3 border-t border-slate-800/30">
          <div className="ml-4 space-y-4">

            {/* Meta row */}
            <div className="grid grid-cols-3 gap-3">
              <MiniCard label="Current Price" value={formatProbability(prob)} valueColor={probColor} />
              <MiniCard label="24h Volume" value={volStr} />
              <MiniCard label="Open Interest" value={market.open_interest > 0 ? `$${market.open_interest.toFixed(0)}` : '—'} />
            </div>

            {/* Cascade section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  {hasCascade ? 'Cascade Signals — if YES resolves' : 'Correlations'}
                </p>
                {hasCascade && (
                  <Link href="/scenario"
                    className="text-[10px] text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-400/50 px-3 py-1 rounded-lg transition-colors font-semibold">
                    Full Analysis →
                  </Link>
                )}
              </div>

              {cascadeLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <div className="w-4 h-4 border-2 border-slate-800 border-t-violet-500 rounded-full animate-spin" />
                  <span className="text-xs text-slate-600">Computing correlations…</span>
                </div>
              ) : !hasCascade ? (
                <div className="py-4 px-4 rounded-xl bg-slate-900/40 border border-slate-800/40">
                  <p className="text-xs text-slate-600">
                    No correlations mapped yet.{' '}
                    <Link href="/scenario" className="text-violet-400 hover:text-violet-300 underline">
                      Explore in Scenario Builder →
                    </Link>
                  </p>
                </div>
              ) : cascade === null ? (
                <p className="text-xs text-slate-700 py-2">Expand to load correlations…</p>
              ) : cascade.length === 0 ? (
                <p className="text-xs text-slate-600 py-2">No correlated markets found.</p>
              ) : (
                <div className="space-y-2">
                  {cascade.slice(0, 5).map(result => (
                    <CascadePreviewRow key={result.market.id} result={result} />
                  ))}
                  {cascade.length > 5 && (
                    <Link href="/scenario"
                      className="block w-full text-center text-[10px] text-slate-600 hover:text-slate-400 py-2.5 transition-colors border border-slate-800/40 rounded-xl hover:border-slate-700/40">
                      +{cascade.length - 5} more — Full Analysis →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cascade preview row ────────────────────────────────────────────────────────

function CascadePreviewRow({ result }: { result: ScenarioResult }) {
  const isUp = result.direction === 'up'
  const isDown = result.direction === 'down'
  return (
    <div className={`grid grid-cols-12 gap-2 px-4 py-2.5 rounded-xl border text-xs transition-colors ${
      isUp ? 'bg-emerald-500/[0.05] border-emerald-500/15' :
      isDown ? 'bg-red-500/[0.05] border-red-500/15' :
      'bg-slate-900/40 border-slate-800/30'
    }`}>
      {/* Trade pill */}
      <div className="col-span-2 flex items-center">
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border tracking-widest ${
          isUp ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
          isDown ? 'bg-red-500/15 text-red-300 border-red-500/30' :
          'bg-slate-800/40 text-slate-500 border-slate-700/30'
        }`}>
          {isUp ? 'BUY YES' : isDown ? 'BUY NO' : 'HOLD'}
        </span>
      </div>

      {/* Title */}
      <div className="col-span-5 flex items-center">
        <p className="text-slate-300 leading-snug line-clamp-1">{result.market.title}</p>
      </div>

      {/* Price */}
      <div className="col-span-3 flex items-center justify-end gap-1.5">
        <span className="font-mono text-slate-500">{formatProbability(result.current_probability)}</span>
        <span className="text-slate-700">→</span>
        <span className={`font-mono font-bold ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-slate-500'}`}>
          {formatProbability(result.implied_probability)}
        </span>
      </div>

      {/* Edge */}
      <div className="col-span-2 flex items-center justify-end">
        <span className={`font-mono font-black text-sm ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-slate-600'}`}>
          {isUp ? '↑' : isDown ? '↓' : '→'}{formatDistortion(result.distortion)}
        </span>
      </div>
    </div>
  )
}

// ── Mini stat card ─────────────────────────────────────────────────────────────

function MiniCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-slate-900/50 rounded-xl px-3 py-2.5 border border-slate-800/40">
      <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1 font-semibold">{label}</p>
      <p className={`text-sm font-mono font-black ${valueColor ?? 'text-slate-200'}`}>{value}</p>
    </div>
  )
}
