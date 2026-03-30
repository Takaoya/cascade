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
    if (cascades[key]) return // already fetched

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

  const goToCascade = (market: TopMarket) => {
    window.location.href = `/scenario`
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans">

      {/* Nav */}
      <header className="border-b border-zinc-800/60 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-bold tracking-widest text-white uppercase hover:text-zinc-300 transition-colors">Cascade</Link>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">Beta</span>
        </div>
        <nav className="flex items-center gap-5">
          <span className="text-xs font-semibold text-white border-b border-indigo-500 pb-0.5">Top Markets</span>
          <Link href="/scenario" className="text-xs text-zinc-400 hover:text-white transition-colors">Scenario Builder →</Link>
        </nav>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-indigo-400 mb-1">Kalshi · Political Markets</p>
              <h1 className="text-2xl font-bold tracking-tight">Market Movers</h1>
              <p className="text-zinc-500 text-sm mt-1">Top 10 most-correlated markets — click any row to see cascade signals</p>
            </div>
            {fetchedAt && (
              <p className="text-[10px] text-zinc-700">
                Live data · {new Date(fetchedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs text-zinc-600">Loading markets...</p>
          </div>
        ) : error || markets.length === 0 ? (
          <div className="text-center py-24 space-y-2">
            <p className="text-zinc-400 text-sm">{error ?? 'No markets found.'}</p>
            <p className="text-zinc-700 text-xs">Make sure the database has been seeded — run <code className="text-zinc-500">npm run seed</code> locally.</p>
          </div>
        ) : (
          <div className="border border-zinc-800/60 rounded-2xl overflow-hidden">

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-zinc-800/60 bg-zinc-900/30">
              <div className="col-span-1 text-[10px] uppercase tracking-widest text-zinc-600">#</div>
              <div className="col-span-4 text-[10px] uppercase tracking-widest text-zinc-600">Market</div>
              <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-zinc-600">Price</div>
              <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-zinc-600">24h Vol</div>
              <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-zinc-600">Signals</div>
              <div className="col-span-1 text-right text-[10px] uppercase tracking-widest text-zinc-600"></div>
            </div>

            {markets.map((market, i) => (
              <TopMarketRow
                key={market.ticker}
                market={market}
                rank={i + 1}
                isExpanded={expandedId === market.ticker}
                onToggle={() => toggleExpand(market)}
                onCascade={() => goToCascade(market)}
                cascade={cascades[market.ticker] ?? null}
                cascadeLoading={cascadeLoading[market.ticker] ?? false}
              />
            ))}
          </div>
        )}

        {/* Legend */}
        {!loading && markets.length > 0 && (
          <div className="mt-4 flex items-center gap-6 text-[10px] text-zinc-700">
            <span>🟢 Green = underpriced if YES</span>
            <span>🔴 Red = overpriced if YES</span>
            <span>Click row to see correlated markets</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Top market row ────────────────────────────────────────────────────────────

function TopMarketRow({
  market, rank, isExpanded, onToggle, onCascade, cascade, cascadeLoading,
}: {
  market: TopMarket
  rank: number
  isExpanded: boolean
  onToggle: () => void
  onCascade: () => void
  cascade: ScenarioResult[] | null
  cascadeLoading: boolean
}) {
  const prob = market.probability
  const vol = market.volume_24h
  const hasCascade = market.db_id && market.relationship_count > 0

  const volStr = vol > 0
    ? vol >= 1000 ? `$${(vol / 1000).toFixed(1)}k` : `$${vol.toFixed(0)}`
    : '—'

  return (
    <div className={`border-b border-zinc-800/30 last:border-b-0 transition-colors ${isExpanded ? 'bg-zinc-900/20' : 'hover:bg-zinc-900/10'}`}>

      {/* Main row */}
      <button onClick={onToggle} className="w-full grid grid-cols-12 gap-3 px-5 py-4 text-left items-center">

        {/* Rank */}
        <div className="col-span-1">
          <span className={`text-sm font-bold font-mono ${rank <= 3 ? 'text-indigo-400' : 'text-zinc-600'}`}>{rank}</span>
        </div>

        {/* Title */}
        <div className="col-span-4">
          <p className="text-sm text-zinc-200 leading-snug line-clamp-2">{market.title}</p>
          <p className="text-[10px] text-zinc-700 mt-0.5 uppercase">{market.event_ticker}</p>
        </div>

        {/* Price */}
        <div className="col-span-2 flex flex-col items-end gap-1">
          <span className="text-sm font-mono font-bold text-zinc-100">{formatProbability(prob)}</span>
          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500/60 rounded-full" style={{ width: `${prob * 100}%` }} />
          </div>
        </div>

        {/* 24h Volume */}
        <div className="col-span-2 text-right">
          <span className={`text-sm font-mono ${vol > 0 ? 'text-zinc-200' : 'text-zinc-700'}`}>{volStr}</span>
        </div>

        {/* Signals badge */}
        <div className="col-span-2 flex justify-end">
          {hasCascade ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
              {market.relationship_count} signals
            </span>
          ) : market.db_id ? (
            <span className="text-[10px] text-zinc-700 px-2 py-1 rounded-full border border-zinc-800/60">unmapped</span>
          ) : (
            <span className="text-[10px] text-zinc-700">—</span>
          )}
        </div>

        {/* Expand chevron */}
        <div className="col-span-1 flex justify-end">
          <svg className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2 border-t border-zinc-800/30">
          <div className="ml-4 space-y-3">

            {/* Market meta */}
            <div className="grid grid-cols-3 gap-3">
              <MiniCard label="Current Price" value={formatProbability(prob)} />
              <MiniCard label="24h Volume" value={volStr} />
              <MiniCard label="Open Interest" value={market.open_interest > 0 ? `$${(market.open_interest).toFixed(0)}` : '—'} />
            </div>

            {/* Cascade section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                  {hasCascade ? 'Correlated Markets — if this resolves YES' : 'Correlations'}
                </p>
                {hasCascade && (
                  <button onClick={e => { e.stopPropagation(); onCascade() }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 px-3 py-1 rounded-lg transition-colors">
                    Full Analysis →
                  </button>
                )}
              </div>

              {cascadeLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <div className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-xs text-zinc-600">Loading correlations...</span>
                </div>
              ) : !hasCascade ? (
                <div className="py-4 px-4 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
                  <p className="text-xs text-zinc-600">
                    {market.db_id
                      ? 'No correlations mapped for this market yet. Use the '
                      : 'This market isn\'t in the database yet. Use the '}
                    <Link href="/scenario" className="text-indigo-400 hover:text-indigo-300 underline">Scenario Builder</Link>
                    {' to explore it manually.'}
                  </p>
                </div>
              ) : cascade === null ? (
                <p className="text-xs text-zinc-700 py-2">Click to load correlations...</p>
              ) : cascade.length === 0 ? (
                <p className="text-xs text-zinc-600 py-2">No correlated markets found.</p>
              ) : (
                <div className="space-y-2">
                  {cascade.slice(0, 5).map(result => (
                    <CascadePreviewRow key={result.market.id} result={result} />
                  ))}
                  {cascade.length > 5 && (
                    <button onClick={e => { e.stopPropagation(); onCascade() }}
                      className="w-full text-center text-[10px] text-zinc-600 hover:text-zinc-400 py-2 transition-colors">
                      +{cascade.length - 5} more — Full Analysis →
                    </button>
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

// ── Cascade preview row (inside expanded market) ──────────────────────────────

function CascadePreviewRow({ result }: { result: ScenarioResult }) {
  const isUp = result.direction === 'up'
  const isDown = result.direction === 'down'
  const edgePp = Math.abs(result.distortion * 100)

  return (
    <div className={`grid grid-cols-12 gap-2 px-4 py-2.5 rounded-xl border text-xs transition-colors ${
      isUp ? 'bg-emerald-500/5 border-emerald-500/15' :
      isDown ? 'bg-red-500/5 border-red-500/15' :
      'bg-zinc-900/40 border-zinc-800/30'
    }`}>
      {/* Trade pill */}
      <div className="col-span-2 flex items-center">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border tracking-wide ${
          isUp ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
          isDown ? 'bg-red-500/15 text-red-300 border-red-500/30' :
          'bg-zinc-800/40 text-zinc-500 border-zinc-700/30'
        }`}>
          {isUp ? 'BUY YES' : isDown ? 'BUY NO' : 'HOLD'}
        </span>
      </div>

      {/* Market title */}
      <div className="col-span-5 flex items-center">
        <p className="text-zinc-300 leading-snug line-clamp-1">{result.market.title}</p>
      </div>

      {/* Now → Fair */}
      <div className="col-span-3 flex items-center justify-end gap-1.5">
        <span className="font-mono text-zinc-500">{formatProbability(result.current_probability)}</span>
        <span className="text-zinc-700">→</span>
        <span className={`font-mono font-semibold ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-zinc-500'}`}>
          {formatProbability(result.implied_probability)}
        </span>
      </div>

      {/* Edge */}
      <div className="col-span-2 flex items-center justify-end">
        <span className={`font-mono font-bold ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-zinc-600'}`}>
          {isUp ? '↑' : isDown ? '↓' : '→'}{formatDistortion(result.distortion)}
        </span>
      </div>
    </div>
  )
}

// ── Mini stat card ────────────────────────────────────────────────────────────

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900/50 rounded-lg px-3 py-2 border border-zinc-800/40">
      <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">{label}</p>
      <p className="text-sm font-mono font-semibold text-zinc-200">{value}</p>
    </div>
  )
}
