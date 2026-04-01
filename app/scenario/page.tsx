'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ShareButton } from '@/components/ShareButton'
import type { Market, ScenarioResult } from '@/lib/probability'
import { formatProbability, formatDistortion } from '@/lib/probability'

export default function ScenarioPage() {
  const [query, setQuery] = useState('')
  const [markets, setMarkets] = useState<Market[]>([])
  const [searching, setSearching] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const [assumedMarket, setAssumedMarket] = useState<Market | null>(null)
  const [assumedProbability, setAssumedProbability] = useState(1.0)
  const [resolvesYes, setResolvesYes] = useState(true)
  const [results, setResults] = useState<ScenarioResult[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [noRelationships, setNoRelationships] = useState(false)

  const runScenario = useCallback(async (market: Market, prob: number, yes: boolean) => {
    setLoading(true)
    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assumed_market_id: market.id, assumed_probability: prob, resolves_yes: yes }),
      })
      const data = await res.json()
      setResults(data.results ?? [])
    } finally { setLoading(false) }
  }, [])

  const handleInputChange = useCallback(async (value: string) => {
    setQuery(value)
    setUrlError(null)
    setNoRelationships(false)

    if (value.includes('kalshi.com/markets/')) {
      setUrlLoading(true)
      setMarkets([])
      setSearchOpen(false)
      try {
        const res = await fetch('/api/markets/from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: value }),
        })
        const data = await res.json()
        if (!res.ok) { setUrlError(data.error ?? 'Could not resolve URL'); return }
        const market = data.market as Market
        setQuery(market.title)
        setAssumedMarket(market)
        setMarkets([])
        setSearchOpen(false)
        setResolvesYes(true)
        setExpandedRow(null)
        setNoRelationships(data.mapped_relationships === 0)
        if (data.mapped_relationships > 0) runScenario(market, assumedProbability, true)
      } catch {
        setUrlError('Failed to fetch market — check your connection')
      } finally {
        setUrlLoading(false)
      }
      return
    }
  }, [assumedProbability, runScenario])

  useEffect(() => {
    if (!query || query.length < 2) { setMarkets([]); return }
    if (query.includes('kalshi.com/markets/')) return
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/markets?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setMarkets(data.markets ?? [])
        setSearchOpen(true)
      } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (market: Market) => {
    setAssumedMarket(market)
    setQuery(market.title)
    setMarkets([])
    setSearchOpen(false)
    setResolvesYes(true)
    setExpandedRow(null)
    setNoRelationships(false)
    setUrlError(null)
    runScenario(market, assumedProbability, true)
  }

  const handleResolutionToggle = (yes: boolean) => {
    setResolvesYes(yes)
    setExpandedRow(null)
    if (assumedMarket) runScenario(assumedMarket, assumedProbability, yes)
  }

  const handleCertaintyChange = (val: number) => {
    setAssumedProbability(val)
    if (assumedMarket) runScenario(assumedMarket, val, resolvesYes)
  }

  const tweetText = assumedMarket
    ? `If "${assumedMarket.title}" resolves ${resolvesYes ? 'YES' : 'NO'} — these Kalshi markets are mispriced via @CascadeMarkets`
    : ''

  const upCount = results.filter(r => r.direction === 'up').length
  const downCount = results.filter(r => r.direction === 'down').length
  const maxEdge = results.length > 0 ? Math.abs(results[0].distortion * 100) : 0
  const avgEdge = results.length > 0
    ? results.reduce((s, r) => s + Math.abs(r.distortion * 100), 0) / results.length
    : 0

  const kalshiUrl = assumedMarket
    ? `https://kalshi.com/markets/${(assumedMarket.category ?? '').toLowerCase()}`
    : null

  return (
    <div className="min-h-screen bg-[#060a0f] text-zinc-100 font-sans flex flex-col">

      {/* Nav */}
      <header className="border-b border-slate-800/60 px-6 py-3 flex items-center justify-between bg-[#060a0f]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm font-black tracking-[0.2em] uppercase bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
            Cascade
          </a>
          <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-violet-500/15 text-violet-400 border border-violet-500/25 uppercase tracking-widest font-bold">Beta</span>
        </div>
        <nav className="flex items-center gap-6">
          <span className="text-xs font-bold text-white relative after:absolute after:-bottom-0.5 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-violet-500 after:to-cyan-500">
            Scenario Builder
          </span>
          <a href="/top" className="text-xs text-slate-500 hover:text-white transition-colors">Market Movers →</a>
        </nav>
      </header>

      {/* ── Search + controls bar ── */}
      <div className="border-b border-slate-800/50 px-6 py-4 bg-slate-900/20">
        <div className="max-w-7xl mx-auto flex items-center gap-4 flex-wrap">

          {/* Search */}
          <div ref={searchRef} className="relative flex-1 min-w-[280px]">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={e => { handleInputChange(e.target.value); setSearchOpen(true) }}
                onFocus={() => markets.length > 0 && setSearchOpen(true)}
                placeholder="Search any Kalshi market or paste a URL…"
                className={`w-full bg-slate-900/80 border rounded-xl pl-11 pr-12 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-all ${
                  urlError
                    ? 'border-red-500/50 focus:border-red-500/70'
                    : 'border-slate-700/50 focus:border-violet-500/50 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.08)]'
                }`}
              />
              {(searching || urlLoading) && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-slate-700 border-t-violet-400 rounded-full animate-spin" />
              )}
              {assumedMarket && !searching && !urlLoading && (
                <button onClick={() => { setAssumedMarket(null); setResults([]); setQuery(''); setExpandedRow(null) }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors text-lg leading-none">
                  ×
                </button>
              )}
            </div>

            {/* Dropdown results */}
            {searchOpen && markets.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden max-h-72 overflow-y-auto">
                {markets.map(market => (
                  <button key={market.id} onClick={() => handleSelect(market)}
                    className="w-full text-left px-4 py-3 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/60 transition-colors group">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-300 group-hover:text-white transition-colors line-clamp-1 flex-1">{market.title}</p>
                      <span className="text-sm font-mono font-black text-white shrink-0">{formatProbability(market.probability)}</span>
                    </div>
                    <div className="mt-1.5 h-0.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-600 to-cyan-600 rounded-full opacity-50" style={{ width: `${market.probability * 100}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {urlError && <p className="mt-1.5 text-[11px] text-red-400">{urlError}</p>}
          </div>

          {/* YES / NO toggle */}
          {assumedMarket && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold shrink-0">Resolves</span>
              <div className="flex rounded-xl overflow-hidden border border-slate-700/40">
                <button onClick={() => handleResolutionToggle(true)}
                  className={`px-4 py-2.5 text-xs font-black tracking-widest transition-all ${
                    resolvesYes ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-600 hover:text-slate-300 bg-slate-900/60'
                  }`}>YES</button>
                <button onClick={() => handleResolutionToggle(false)}
                  className={`px-4 py-2.5 text-xs font-black tracking-widest border-l border-slate-700/40 transition-all ${
                    !resolvesYes ? 'bg-red-500/20 text-red-300' : 'text-slate-600 hover:text-slate-300 bg-slate-900/60'
                  }`}>NO</button>
              </div>
            </div>
          )}

          {/* Certainty */}
          {assumedMarket && (
            <div className="flex items-center gap-3 min-w-[180px]">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold shrink-0">Certainty</span>
              <input type="range" min="1" max="100" value={Math.round(assumedProbability * 100)}
                onChange={e => handleCertaintyChange(Number(e.target.value) / 100)}
                className="flex-1 accent-violet-500 cursor-pointer" />
              <span className="text-sm font-mono font-black text-violet-400 w-10 text-right">{Math.round(assumedProbability * 100)}%</span>
            </div>
          )}

          {/* Actions */}
          {assumedMarket && results.length > 0 && !loading && (
            <div className="flex items-center gap-2">
              <ShareButton targetId="scenario-header" tweetText={tweetText} />
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {!assumedMarket ? (
          <EmptyState onSearch={v => { setQuery(v); setSearchOpen(true) }} />
        ) : (
          <>
            {/* Scenario header strip */}
            <div id="scenario-header" className="px-6 py-4 bg-gradient-to-r from-slate-900/60 to-transparent border-b border-slate-800/40">
              <div className="max-w-7xl mx-auto flex items-start justify-between gap-6 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">Scenario</span>
                    <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full tracking-widest ${
                      resolvesYes ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' : 'bg-red-500/15 text-red-300 border border-red-500/25'
                    }`}>{resolvesYes ? '✓ YES' : '✗ NO'}</span>
                    <span className="text-[9px] text-slate-600">at {Math.round(assumedProbability * 100)}% certainty</span>
                    {kalshiUrl && (
                      <a href={kalshiUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[9px] text-violet-500 hover:text-violet-300 flex items-center gap-1 transition-colors ml-1">
                        View on Kalshi
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                  <p className="text-base font-bold text-white leading-snug">{assumedMarket.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Current price: <span className="font-mono text-slate-300 font-bold">{formatProbability(assumedMarket.probability)}</span>
                  </p>
                </div>

                {/* Stat pills */}
                {results.length > 0 && !loading && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tooltip text="Total related markets with a meaningful probability shift given this scenario.">
                      <StatPill label="Signals" value={String(results.length)} />
                    </Tooltip>
                    <Tooltip text="Markets where fair value is HIGHER than current price — potentially underpriced if this resolves YES.">
                      <StatPill label="Buy YES" value={String(upCount)} color="emerald" />
                    </Tooltip>
                    <Tooltip text="Markets where fair value is LOWER than current price — potentially overpriced if this resolves YES.">
                      <StatPill label="Buy NO" value={String(downCount)} color="red" />
                    </Tooltip>
                    <Tooltip text="The largest single mispricing found, in percentage points. Higher = bigger gap between current price and fair value.">
                      <StatPill label="Max Edge" value={`${maxEdge.toFixed(1)}pp`} color="yellow" glow={maxEdge > 10} />
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>

            {/* Results table */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <div className="w-6 h-6 border-2 border-slate-800 border-t-violet-500 rounded-full animate-spin" />
                  <p className="text-xs text-slate-600 tracking-widest uppercase">Computing cascade…</p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  {noRelationships ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg font-bold">!</div>
                      <div className="text-center max-w-sm">
                        <p className="text-slate-200 text-sm font-semibold mb-1">Market loaded — no correlations mapped yet</p>
                        <p className="text-slate-600 text-xs leading-relaxed">
                          Try{' '}
                          <button onClick={() => { setQuery('Trump resign'); setSearchOpen(true) }} className="text-violet-400 hover:text-violet-300 underline">Trump resign</button>
                          {' '}or{' '}
                          <button onClick={() => { setQuery('Fed abolished'); setSearchOpen(true) }} className="text-violet-400 hover:text-violet-300 underline">Fed abolished</button>
                          {' '}to see a full cascade.
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-500 text-sm">No related markets mapped for this scenario.</p>
                  )}
                </div>
              ) : (
                <div className="max-w-7xl mx-auto">
                  {/* Column headers */}
                  <div className="grid grid-cols-12 gap-2 px-6 py-2.5 border-b border-slate-800/40 sticky top-0 bg-[#060a0f] z-10">
                    <div className="col-span-4 text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Market</div>
                    <div className="col-span-2 text-center">
                      <Tooltip text="Recommended action — BUY YES if underpriced, BUY NO if overpriced.">
                        <span className="text-[10px] uppercase tracking-widest text-slate-600 cursor-default underline decoration-dotted decoration-slate-700 font-semibold">Trade</span>
                      </Tooltip>
                    </div>
                    <div className="col-span-1 text-right">
                      <Tooltip text="Current market price on Kalshi right now.">
                        <span className="text-[10px] uppercase tracking-widest text-slate-600 cursor-default underline decoration-dotted decoration-slate-700 font-semibold">Now</span>
                      </Tooltip>
                    </div>
                    <div className="col-span-1 text-right">
                      <Tooltip text="Implied fair value if your assumed scenario is correct.">
                        <span className="text-[10px] uppercase tracking-widest text-slate-600 cursor-default underline decoration-dotted decoration-slate-700 font-semibold">Fair</span>
                      </Tooltip>
                    </div>
                    <div className="col-span-2 text-right">
                      <Tooltip text="The gap between fair value and current price. ↑ = underpriced, ↓ = overpriced.">
                        <span className="text-[10px] uppercase tracking-widest text-slate-600 cursor-default underline decoration-dotted decoration-slate-700 font-semibold">Edge</span>
                      </Tooltip>
                    </div>
                    <div className="col-span-1 text-center">
                      <Tooltip text="Confidence based on relationship strength. 3 dots = high conviction.">
                        <span className="text-[10px] uppercase tracking-widest text-slate-600 cursor-default underline decoration-dotted decoration-slate-700 font-semibold">Signal</span>
                      </Tooltip>
                    </div>
                    <div className="col-span-1 text-right">
                      <Tooltip text="Edge in percentage points. Higher = larger mispricing.">
                        <span className="text-[10px] uppercase tracking-widest text-slate-600 cursor-default underline decoration-dotted decoration-slate-700 font-semibold">Score</span>
                      </Tooltip>
                    </div>
                  </div>

                  {results.map((result, i) => (
                    <ResultRow key={result.market.id} result={result} rank={i + 1}
                      isExpanded={expandedRow === result.market.id}
                      onToggle={() => setExpandedRow(expandedRow === result.market.id ? null : result.market.id)}
                    />
                  ))}

                  {/* Footer */}
                  <div className="border-t border-slate-800/50 px-6 py-2.5 flex items-center gap-5 text-[10px] text-slate-600 sticky bottom-0 bg-[#060a0f]">
                    <span>{results.length} markets analyzed</span>
                    <span>Avg edge: <span className="text-slate-400 font-mono font-bold">{avgEdge.toFixed(1)}pp</span></span>
                    <span className="hidden sm:inline">Best: <span className={`font-mono font-bold ${results[0].distortion > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatDistortion(results[0].distortion)}</span> on <span className="text-slate-500">{results[0].market.title.slice(0, 30)}…</span></span>
                    <span className="ml-auto text-slate-700">↓ Click any row to expand</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = React.useRef<HTMLDivElement>(null)

  const show = () => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ top: r.bottom + 8, left: r.left + r.width / 2 })
    setVisible(true)
  }

  return (
    <div ref={ref} onMouseEnter={show} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className="fixed z-[999] w-56 pointer-events-none"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}>
          <div className="bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2.5 shadow-2xl shadow-black/40">
            <p className="text-[11px] text-slate-300 leading-relaxed text-center">{text}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, color, glow }: { label: string; value: string; color?: string; glow?: boolean }) {
  const styles: Record<string, string> = {
    emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    red: 'text-red-300 bg-red-500/10 border-red-500/20',
    yellow: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
    default: 'text-slate-200 bg-slate-800/60 border-slate-700/30',
  }
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl border ${styles[color ?? 'default']}`}
      style={glow ? { boxShadow: '0 0 16px rgba(251,191,36,0.15)' } : {}}>
      <span className="text-base font-black font-mono leading-none">{value}</span>
      <span className="text-[9px] uppercase tracking-widest mt-0.5 opacity-60 font-semibold">{label}</span>
    </div>
  )
}

// ── Signal dots ───────────────────────────────────────────────────────────────
function SignalDots({ weight }: { weight: number }) {
  const filled = weight >= 0.7 ? 3 : weight >= 0.45 ? 2 : 1
  return (
    <div className="flex items-center gap-1 justify-center">
      {[1, 2, 3].map(i => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= filled ? 'bg-violet-400' : 'bg-slate-700'}`} />
      ))}
    </div>
  )
}

// ── Result row ────────────────────────────────────────────────────────────────
function ResultRow({ result, rank, isExpanded, onToggle }: {
  result: ScenarioResult; rank: number; isExpanded: boolean; onToggle: () => void
}) {
  const { market, current_probability, implied_probability, distortion, direction, weight, analysis, relationship_type } = result
  const isUp = direction === 'up'
  const isDown = direction === 'down'
  const distColor = isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-slate-500'
  const edgeScore = Math.abs(distortion * 100)
  const isHighEdge = edgeScore > 10

  const tradeLabel = isUp ? 'BUY YES' : isDown ? 'BUY NO' : 'NEUTRAL'
  const tradeBg = isUp
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : isDown
    ? 'bg-red-500/15 text-red-300 border-red-500/30'
    : 'bg-slate-800/40 text-slate-500 border-slate-700/30'

  const leftBorder = isUp ? 'border-l-emerald-500/60' : isDown ? 'border-l-red-500/60' : 'border-l-transparent'
  const rowBg = isExpanded
    ? (isUp ? 'bg-emerald-500/[0.04]' : isDown ? 'bg-red-500/[0.04]' : 'bg-slate-800/10')
    : (isUp ? 'hover:bg-emerald-500/[0.03]' : isDown ? 'hover:bg-red-500/[0.03]' : 'hover:bg-slate-800/10')

  const kalshiLink = `https://kalshi.com/markets/${(market.category ?? '').toLowerCase()}`

  return (
    <div className={`border-b border-slate-800/30 border-l-2 ${leftBorder} transition-all ${rowBg}`}>
      <button onClick={onToggle} className="w-full grid grid-cols-12 gap-2 px-6 py-3.5 text-left">
        <div className="col-span-4 flex items-start gap-2 min-w-0">
          <span className="text-[10px] text-slate-700 font-mono mt-0.5 shrink-0 w-4 font-bold">{rank}</span>
          <p className="text-xs text-slate-300 leading-snug line-clamp-2">{market.title}</p>
        </div>
        <div className="col-span-2 flex items-center justify-center">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border tracking-widest ${tradeBg}`}>{tradeLabel}</span>
        </div>
        <div className="col-span-1 flex items-center justify-end">
          <span className="text-xs font-mono text-slate-500">{formatProbability(current_probability)}</span>
        </div>
        <div className="col-span-1 flex items-center justify-end">
          <span className={`text-xs font-mono font-bold ${distColor}`}>{formatProbability(implied_probability)}</span>
        </div>
        <div className="col-span-2 flex flex-col items-end justify-center gap-1">
          <span className={`text-sm font-mono font-black ${distColor}`}>
            {isUp ? '↑' : isDown ? '↓' : '→'} {formatDistortion(distortion)}
          </span>
          <div className="w-full h-0.5 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${isUp ? 'bg-emerald-500' : isDown ? 'bg-red-500' : 'bg-slate-500'}`}
              style={{ width: `${Math.min(100, edgeScore * 3)}%`, opacity: 0.7 }} />
          </div>
        </div>
        <div className="col-span-1 flex items-center justify-center">
          <SignalDots weight={weight} />
        </div>
        <div className="col-span-1 flex items-center justify-end">
          <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
            isHighEdge ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'text-slate-600'
          }`}>{edgeScore.toFixed(1)}</span>
        </div>
      </button>

      {/* Expanded analysis */}
      {isExpanded && (
        <div className={`px-6 pb-5 pt-2 border-t ${isUp ? 'border-emerald-500/10' : isDown ? 'border-red-500/10' : 'border-slate-800/30'}`}>
          <div className="ml-6 space-y-4">

            {/* Trade thesis */}
            <div className={`rounded-xl p-4 border ${isUp ? 'bg-emerald-500/[0.06] border-emerald-500/20' : isDown ? 'bg-red-500/[0.06] border-red-500/20' : 'bg-slate-800/20 border-slate-700/30'}`}>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${tradeBg}`}>{tradeLabel}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Trade thesis</span>
                </div>
                <a href={kalshiLink} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                  Trade on Kalshi
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {isUp
                  ? `Market is at ${formatProbability(current_probability)}. Fair value given this scenario is ~${formatProbability(implied_probability)} — ${formatDistortion(distortion)} higher. Appears underpriced. Consider buying YES.`
                  : isDown
                  ? `Market is at ${formatProbability(current_probability)}. Fair value given this scenario is ~${formatProbability(implied_probability)} — ${formatDistortion(Math.abs(distortion))} lower. Appears overpriced. Consider buying NO.`
                  : `This market is unlikely to move significantly given this scenario.`
                }
              </p>
            </div>

            {/* Why it moves */}
            <div className="rounded-xl p-4 bg-slate-900/50 border border-slate-800/40">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">Why it moves</p>
              <p className="text-xs text-slate-300 leading-relaxed">{analysis}</p>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-4 gap-3">
              <MetaCard label="Relationship" value={relationship_type}
                color={relationship_type === 'positive' ? 'emerald' : relationship_type === 'negative' ? 'red' : 'zinc'} />
              <MetaCard label="Signal Weight" value={`${(weight * 100).toFixed(0)}%`}
                sub={weight >= 0.7 ? 'High conviction' : weight >= 0.45 ? 'Moderate' : 'Low conviction'} />
              <MetaCard label="Edge" value={`${edgeScore.toFixed(1)}pp`}
                sub={isHighEdge ? 'Notable opportunity' : 'Modest signal'}
                color={isHighEdge ? 'yellow' : 'zinc'} />
              <MetaCard label="Direction" value={isUp ? 'Underpriced' : isDown ? 'Overpriced' : 'Neutral'}
                color={isUp ? 'emerald' : isDown ? 'red' : 'zinc'} />
            </div>

            {/* Probability bar */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Probability shift</p>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-500 w-12 text-right">{formatProbability(current_probability)}</span>
                <div className="flex-1 h-2 bg-slate-800 rounded-full relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-slate-600 rounded-full" style={{ width: `${current_probability * 100}%` }} />
                  <div className={`absolute inset-y-0 left-0 rounded-full opacity-80 ${isUp ? 'bg-emerald-500' : isDown ? 'bg-red-500' : 'bg-slate-500'}`}
                    style={{ width: `${implied_probability * 100}%` }} />
                </div>
                <span className={`text-xs font-mono font-black w-12 ${distColor}`}>{formatProbability(implied_probability)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-12" />
                <div className="flex-1 flex justify-between text-[10px] text-slate-700">
                  <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                </div>
                <span className="w-12" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetaCard({ label, value, sub, color = 'zinc' }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400', red: 'text-red-400', yellow: 'text-amber-300', zinc: 'text-slate-200'
  }
  return (
    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/40">
      <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1 font-semibold">{label}</p>
      <p className={`text-xs font-bold capitalize ${colors[color]}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function EmptyState({ onSearch }: { onSearch: (q: string) => void }) {
  const examples = [
    { q: 'Trump resign', scenario: 'YES', impact: '↓ GOP 2028  ↑ Impeach odds', icon: '🏛️' },
    { q: 'Fed abolished', scenario: 'NO', impact: '→ Debt ceiling  fiscal markets', icon: '📈' },
    { q: 'China trade deal', scenario: 'YES', impact: '↓ GDP gap  ↑ Manufacturing', icon: '🌐' },
    { q: 'Taiwan', scenario: 'YES', impact: '↑ Level 4 advisory issued', icon: '⚔️' },
  ]
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="text-center space-y-3 max-w-xl">
        <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">
          Model a conditional scenario
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          Search for any Kalshi market above. Toggle YES or NO. Cascade surfaces which related markets are mispriced — and exactly what to trade.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-4 font-semibold">Example scenarios</p>
        <div className="grid grid-cols-2 gap-3">
          {examples.map(ex => (
            <button key={ex.q} onClick={() => onSearch(ex.q)}
              className="text-left p-5 rounded-2xl bg-slate-900/50 border border-slate-800/50 hover:border-violet-500/30 hover:bg-slate-800/30 transition-all group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 to-cyan-500/0 group-hover:from-violet-500/5 group-hover:to-cyan-500/5 transition-all" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{ex.icon}</span>
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{ex.q}</p>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest shrink-0 ${
                      ex.scenario === 'YES'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/15 text-red-400 border border-red-500/20'
                    }`}>{ex.scenario}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">{ex.impact}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 text-[10px] text-slate-700 font-medium">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Underpriced → BUY YES</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Overpriced → BUY NO</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Score = edge in pp</span>
      </div>
    </div>
  )
}
