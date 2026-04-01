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
  kalshi_url?: string
}

import type { ScenarioResult } from '@/lib/probability'
import { formatProbability } from '@/lib/probability'

// Category → visual theme
function getMarketTheme(ticker: string, title: string): { gradient: string; accent: string; icon: string } {
  const t = (ticker + title).toLowerCase()
  if (t.includes('trump') || t.includes('president') || t.includes('resign') || t.includes('impeach') || t.includes('cabinet'))
    return { gradient: 'from-red-900/80 via-red-950/60 to-slate-950', accent: 'text-red-400', icon: '🏛️' }
  if (t.includes('fed') || t.includes('rate') || t.includes('gdp') || t.includes('inflation') || t.includes('economy') || t.includes('debt'))
    return { gradient: 'from-emerald-900/80 via-emerald-950/60 to-slate-950', accent: 'text-emerald-400', icon: '📈' }
  if (t.includes('china') || t.includes('taiwan') || t.includes('trade') || t.includes('tariff'))
    return { gradient: 'from-amber-900/80 via-amber-950/60 to-slate-950', accent: 'text-amber-400', icon: '🌐' }
  if (t.includes('war') || t.includes('ukraine') || t.includes('russia') || t.includes('zelenskyy') || t.includes('iran') || t.includes('nuclear') || t.includes('military'))
    return { gradient: 'from-orange-900/80 via-orange-950/60 to-slate-950', accent: 'text-orange-400', icon: '⚔️' }
  if (t.includes('election') || t.includes('senate') || t.includes('house') || t.includes('congress') || t.includes('vote'))
    return { gradient: 'from-blue-900/80 via-blue-950/60 to-slate-950', accent: 'text-blue-400', icon: '🗳️' }
  if (t.includes('kim') || t.includes('korea') || t.includes('canal') || t.includes('territory') || t.includes('greenland'))
    return { gradient: 'from-violet-900/80 via-violet-950/60 to-slate-950', accent: 'text-violet-400', icon: '🌍' }
  if (t.includes('climate') || t.includes('energy') || t.includes('oil') || t.includes('power'))
    return { gradient: 'from-teal-900/80 via-teal-950/60 to-slate-950', accent: 'text-teal-400', icon: '⚡' }
  return { gradient: 'from-slate-800/80 via-slate-900/60 to-slate-950', accent: 'text-violet-400', icon: '📊' }
}

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
        if (d.error && !d.markets?.length) setError(d.error)
        else { setMarkets(d.markets ?? []); setFetchedAt(d.fetched_at ?? null) }
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

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-violet-400 mb-2 font-bold">Kalshi · Political Markets</p>
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Market Movers
            </h1>
            <p className="text-slate-500 text-sm mt-2">Top correlated markets — click any card to see cascade signals</p>
          </div>
          {fetchedAt && (
            <div className="flex items-center gap-2 text-[10px] text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Live · {new Date(fetchedAt).toLocaleTimeString()}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <div className="w-8 h-8 border-2 border-slate-800 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-xs text-slate-600 tracking-widest uppercase">Loading markets…</p>
          </div>
        ) : error || markets.length === 0 ? (
          <div className="text-center py-40 space-y-3">
            <p className="text-slate-400 text-sm">{error ?? 'No markets found.'}</p>
            <p className="text-slate-700 text-xs">Run <code className="text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">npm run seed</code> locally to populate the database.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
        )}

        {/* Legend */}
        {!loading && markets.length > 0 && (
          <div className="mt-8 flex items-center gap-6 text-[10px] text-slate-700 font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Underpriced → BUY YES</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Overpriced → BUY NO</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> Signals = mapped correlations</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Market Card ────────────────────────────────────────────────────────────────

function MarketCard({
  market, rank, isExpanded, onToggle, cascade, cascadeLoading,
}: {
  market: TopMarket
  rank: number
  isExpanded: boolean
  onToggle: () => void
  cascade: ScenarioResult[] | null
  cascadeLoading: boolean
}) {
  const theme = getMarketTheme(market.event_ticker, market.title)
  const prob = market.probability
  const hasCascade = market.db_id && market.relationship_count > 0

  const probColor = prob >= 0.65 ? 'text-emerald-400' : prob <= 0.35 ? 'text-red-400' : 'text-white'
  const barColor = prob >= 0.65 ? 'bg-emerald-500' : prob <= 0.35 ? 'bg-red-500' : 'bg-violet-500'

  return (
    <div className={`rounded-2xl border border-slate-800/60 overflow-hidden bg-slate-900/40 flex flex-col transition-all hover:border-slate-700/60 hover:shadow-lg hover:shadow-black/20 ${isExpanded ? 'ring-1 ring-violet-500/30' : ''}`}>

      {/* Card header — gradient banner with icon + rank */}
      <div className={`relative h-28 bg-gradient-to-br ${theme.gradient} flex items-end p-4 overflow-hidden`}>
        {/* Rank badge */}
        <div className={`absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${rank <= 3 ? 'bg-gradient-to-br from-violet-500 to-cyan-500 text-white' : 'bg-slate-800/60 text-slate-400'}`}>
          {rank}
        </div>

        {/* Large background icon */}
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl opacity-20 select-none">{theme.icon}</span>

        {/* Probability — hero number */}
        <div className="flex-1">
          <p className={`text-3xl font-black font-mono ${probColor}`}>{formatProbability(prob)}</p>
          <div className="mt-1.5 w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full opacity-80`} style={{ width: `${prob * 100}%` }} />
          </div>
        </div>

        {/* Signal badge */}
        {hasCascade && (
          <div className="ml-3 shrink-0">
            <div className="flex flex-col items-center px-2.5 py-1.5 rounded-xl bg-black/30 border border-violet-500/20"
              style={{ boxShadow: '0 0 12px rgba(139,92,246,0.2)' }}>
              <span className="text-lg font-black text-violet-300 leading-none">{market.relationship_count}</span>
              <span className="text-[8px] uppercase tracking-widest text-violet-400/70 font-bold">signals</span>
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex-1 p-4 space-y-3">
        {/* Title */}
        <div>
          <p className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">{market.title}</p>
          <p className={`text-[10px] font-mono uppercase mt-1 ${theme.accent} opacity-70`}>{market.event_ticker}</p>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 pt-1">
          {/* View on Kalshi */}
          {market.kalshi_url && (
            <a
              href={market.kalshi_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/40 hover:border-slate-600/60 rounded-xl transition-all"
            >
              <span>View on Kalshi</span>
              <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}

          {/* Cascade / expand button */}
          <button
            onClick={onToggle}
            className={`flex items-center gap-1.5 py-2 px-3 text-[11px] font-bold rounded-xl border transition-all ${
              hasCascade
                ? 'text-violet-300 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/20'
                : 'text-slate-600 bg-slate-800/30 border-slate-800/40 cursor-default'
            }`}
          >
            {hasCascade ? 'Cascade' : 'Unmapped'}
            {hasCascade && (
              <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>

        {/* URL display */}
        {market.kalshi_url && (
          <p className="text-[9px] text-slate-700 font-mono truncate">{market.kalshi_url}</p>
        )}
      </div>

      {/* Expanded cascade panel */}
      {isExpanded && hasCascade && (
        <div className="border-t border-slate-800/50 p-4 space-y-2.5 bg-slate-900/50">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              Cascade signals — if YES
            </p>
            <Link href="/scenario" className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Full Analysis →
            </Link>
          </div>

          {cascadeLoading ? (
            <div className="flex items-center gap-2 py-3">
              <div className="w-4 h-4 border-2 border-slate-800 border-t-violet-500 rounded-full animate-spin" />
              <span className="text-xs text-slate-600">Computing…</span>
            </div>
          ) : cascade === null ? (
            <p className="text-xs text-slate-700 py-2">Loading correlations…</p>
          ) : cascade.length === 0 ? (
            <p className="text-xs text-slate-600 py-2">No correlated markets found.</p>
          ) : (
            <div className="space-y-1.5">
              {cascade.slice(0, 4).map(result => {
                const isUp = result.direction === 'up'
                const isDown = result.direction === 'down'
                const kalshiLink = `https://kalshi.com/markets/${(result.market.category ?? '').toLowerCase()}`

                return (
                  <div key={result.market.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                      isUp ? 'bg-emerald-500/[0.06] border-emerald-500/15' :
                      isDown ? 'bg-red-500/[0.06] border-red-500/15' :
                      'bg-slate-800/30 border-slate-700/30'
                    }`}>
                    {/* Trade pill */}
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border shrink-0 tracking-widest ${
                      isUp ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' :
                      isDown ? 'bg-red-500/15 text-red-300 border-red-500/25' :
                      'bg-slate-700/30 text-slate-500 border-slate-700/30'
                    }`}>
                      {isUp ? 'BUY YES' : isDown ? 'BUY NO' : 'HOLD'}
                    </span>

                    {/* Title */}
                    <p className={`flex-1 text-[11px] leading-snug line-clamp-1 ${isUp ? 'text-slate-200' : isDown ? 'text-slate-200' : 'text-slate-500'}`}>
                      {result.market.title}
                    </p>

                    {/* Price shift */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-mono text-slate-600">{formatProbability(result.current_probability)}</span>
                      <span className="text-slate-700">→</span>
                      <span className={`font-mono font-black ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-slate-500'}`}>
                        {formatProbability(result.implied_probability)}
                      </span>
                    </div>

                    {/* Kalshi link */}
                    <a href={kalshiLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="shrink-0 text-slate-700 hover:text-violet-400 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )
              })}

              {cascade.length > 4 && (
                <Link href="/scenario"
                  className="block w-full text-center text-[10px] text-slate-600 hover:text-violet-400 py-2 transition-colors">
                  +{cascade.length - 4} more signals — Full Analysis →
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
