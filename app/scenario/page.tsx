'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ShareButton } from '@/components/ShareButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import type { Market, ScenarioResult } from '@/lib/probability'
import { formatProbability, formatDistortion } from '@/lib/probability'

// KalshiLink: resolves the correct Kalshi URL server-side then opens it.
function KalshiLink({ ticker, className, children }: {
  ticker: string; className?: string; children: React.ReactNode
}) {
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/markets/kalshi-url?ticker=${encodeURIComponent(ticker)}`)
      const { url } = await res.json()
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      // fallback: best-effort slug
      const slug = ticker.replace(/-(?:YES|NO)$/i, '').replace(/-\d{2}[A-Z0-9]*$/i, '').toUpperCase()
      window.open(`https://kalshi.com/markets/${slug}`, '_blank', 'noopener,noreferrer')
    }
  }
  return <button onClick={handleClick} className={className}>{children}</button>
}

export default function ScenarioPage() {
  const [query, setQuery] = useState('')
  const [markets, setMarkets] = useState<Market[]>([])
  const [searching, setSearching] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const heroSearchRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const inSearch = searchRef.current?.contains(target)
      const inHero = heroSearchRef.current?.contains(target)
      if (!inSearch && !inHero) setSearchOpen(false)
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

  const assumedTicker = assumedMarket?.external_id ?? null

  const SearchDropdown = () => searchOpen && markets.length > 0 ? (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/60 z-50 overflow-hidden max-h-72 overflow-y-auto">
      {markets.map(market => (
        <button key={market.id} onClick={() => handleSelect(market)}
          className="w-full text-left px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.05] last:border-0 hover:bg-green-50 dark:hover:bg-white/[0.05] transition-colors group">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-green-700 dark:group-hover:text-white transition-colors line-clamp-1 flex-1">{market.title}</p>
            <span className="text-sm font-mono font-black text-slate-800 dark:text-white shrink-0">{formatProbability(market.probability)}</span>
          </div>
          <div className="mt-2 h-px bg-slate-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full opacity-60" style={{ width: `${market.probability * 100}%` }} />
          </div>
        </button>
      ))}
    </div>
  ) : null

  return (
    <div className="min-h-screen bg-[#f7fdf7] dark:bg-[#050505] text-slate-800 dark:text-white font-sans flex flex-col transition-colors duration-200">

      {/* ── Nav ── */}
      <header className="border-b border-slate-200 dark:border-white/[0.06] px-6 py-3.5 flex items-center justify-between bg-white/80 dark:bg-black/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm font-black tracking-[0.2em] uppercase text-slate-900 dark:text-white">CASCADE</a>
          <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/25 uppercase tracking-widest font-bold">Beta</span>
        </div>
        <nav className="flex items-center gap-5">
          <span className="text-xs font-bold text-slate-800 dark:text-white relative after:absolute after:-bottom-0.5 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-green-500 after:to-emerald-500">
            Scenario
          </span>
          <a href="/top" className="text-xs text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white transition-colors">Market Movers →</a>
          <ThemeToggle />
        </nav>
      </header>

      {/* ── News ticker ── */}
      <NewsTicker />

      {!assumedMarket ? (
        /* ── HERO empty state ── */
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center px-6 py-16">
            <div className="w-full max-w-xl space-y-8">

              <p className="text-center text-[11px] uppercase tracking-[0.35em] text-green-600 dark:text-green-400 font-semibold">
                Conditional Probability Engine
              </p>

              <div className="text-center space-y-2">
                <h1 className="text-4xl sm:text-[52px] font-black leading-[1.08] tracking-tight text-slate-900 dark:text-white">
                  Find markets the<br/>scenario missed.
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base leading-relaxed max-w-sm mx-auto pt-2">
                  Pick any Kalshi market, toggle YES or NO. Cascade surfaces every correlated market that&apos;s now mispriced.
                </p>
              </div>

              <p className="text-center">
                <button
                  onClick={() => { setQuery('Trump resign'); setSearchOpen(true) }}
                  className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 underline underline-offset-4 transition-colors">
                  Try an example →
                </button>
              </p>

              {/* Hero search bar */}
              <div ref={heroSearchRef} className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={e => { handleInputChange(e.target.value); setSearchOpen(true) }}
                  onFocus={() => markets.length > 0 && setSearchOpen(true)}
                  placeholder="Search any Kalshi market or paste a URL…"
                  className={`w-full bg-white dark:bg-white/[0.07] border rounded-2xl pl-5 pr-36 py-5 text-base text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none transition-all ${
                    urlError
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-slate-200 dark:border-white/10 focus:border-green-500 focus:shadow-[0_0_0_3px_rgba(34,197,94,0.1)]'
                  }`}
                />
                {(searching || urlLoading) ? (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-slate-200 dark:border-white/20 border-t-green-500 rounded-full animate-spin" />
                ) : (
                  <button className="absolute right-2 top-2 bottom-2 px-5 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-xl transition-colors tracking-wide">
                    Analyze →
                  </button>
                )}
                <SearchDropdown />
                {urlError && <p className="mt-2 text-[12px] text-red-500">{urlError}</p>}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] text-slate-400 dark:text-white/30">
                <span className="flex items-center gap-1.5">⚡ Real-time Kalshi prices</span>
                <span className="flex items-center gap-1.5">🔗 13,200+ markets tracked</span>
                <span className="flex items-center gap-1.5">🤖 AI-mapped correlations</span>
              </div>
            </div>
          </div>

          <ExampleCards onSearch={v => { setQuery(v); setSearchOpen(true) }} />
        </div>

      ) : (
        /* ── ANALYSIS LAYOUT ── */
        <>
          <div className="border-b border-slate-200 dark:border-white/[0.06] px-4 sm:px-6 py-3 bg-white/60 dark:bg-black/20">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">

              <div ref={searchRef} className="relative flex-1 min-w-0 sm:min-w-[280px]">
                <div className="relative">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/30 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={query}
                    onChange={e => { handleInputChange(e.target.value); setSearchOpen(true) }}
                    onFocus={() => markets.length > 0 && setSearchOpen(true)}
                    placeholder="Search or paste a Kalshi URL…"
                    className="w-full bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 rounded-xl pl-11 pr-10 py-2.5 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-green-500/60 transition-all"
                  />
                  {(searching || urlLoading) && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-slate-200 dark:border-white/20 border-t-green-500 rounded-full animate-spin" />
                  )}
                  {assumedMarket && !searching && !urlLoading && (
                    <button onClick={() => { setAssumedMarket(null); setResults([]); setQuery(''); setExpandedRow(null) }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/80 transition-colors text-lg leading-none">
                      ×
                    </button>
                  )}
                </div>
                <SearchDropdown />
                {urlError && <p className="mt-1.5 text-[11px] text-red-500">{urlError}</p>}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 font-semibold shrink-0">Resolves</span>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-white/10">
                  <button onClick={() => handleResolutionToggle(true)}
                    className={`px-4 py-2 text-xs font-black tracking-widest transition-all ${
                      resolvesYes
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 bg-white dark:bg-white/[0.03]'
                    }`}>YES</button>
                  <button onClick={() => handleResolutionToggle(false)}
                    className={`px-4 py-2 text-xs font-black tracking-widest border-l border-slate-200 dark:border-white/10 transition-all ${
                      !resolvesYes
                        ? 'bg-red-500/20 text-red-700 dark:text-red-400'
                        : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 bg-white dark:bg-white/[0.03]'
                    }`}>NO</button>
                </div>
                <AdvancedCertainty probability={assumedProbability} onChange={handleCertaintyChange} />
                {results.length > 0 && !loading && (
                  <div className="ml-auto sm:ml-0">
                    <ShareButton targetId="scenario-header" tweetText={tweetText} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div id="scenario-header" className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-white/[0.05] bg-slate-50 dark:bg-white/[0.02]">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 dark:text-white/30 font-semibold">Scenario</span>
                  <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full tracking-widest ${
                    resolvesYes
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                      : 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/25'
                  }`}>{resolvesYes ? '✓ YES' : '✗ NO'}</span>
                  <span className="text-[9px] text-slate-400 dark:text-white/25">at {Math.round(assumedProbability * 100)}% certainty</span>
                  {assumedTicker && (
                    <KalshiLink ticker={assumedTicker}
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/25 hover:bg-green-500/20 transition-all ml-1">
                      View on Kalshi
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </KalshiLink>
                  )}
                </div>
                <p className="text-base font-bold text-slate-900 dark:text-white leading-snug">{assumedMarket.title}</p>
                <p className="text-xs text-slate-400 dark:text-white/30 mt-0.5">
                  Current price: <span className="font-mono text-slate-700 dark:text-white/60 font-bold">{formatProbability(assumedMarket.probability)}</span>
                </p>
              </div>

              {results.length > 0 && !loading && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tooltip text="Total related markets with a meaningful probability shift given this scenario.">
                    <StatPill label="Signals" value={String(results.length)} />
                  </Tooltip>
                  <Tooltip text="Markets where fair value is HIGHER than current price — potentially underpriced.">
                    <StatPill label="Buy YES" value={String(upCount)} color="emerald" />
                  </Tooltip>
                  <Tooltip text="Markets where fair value is LOWER than current price — potentially overpriced.">
                    <StatPill label="Buy NO" value={String(downCount)} color="red" />
                  </Tooltip>
                  <Tooltip text="The largest single mispricing found, in percentage points.">
                    <StatPill label="Max Edge" value={`${maxEdge.toFixed(1)}pp`} color="yellow" glow={maxEdge > 10} />
                  </Tooltip>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-6 h-6 border-2 border-slate-200 dark:border-white/10 border-t-green-500 rounded-full animate-spin" />
                <p className="text-xs text-slate-400 dark:text-white/30 tracking-widest uppercase">Computing cascade…</p>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                {noRelationships ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-lg font-bold">!</div>
                    <div className="text-center max-w-sm">
                      <p className="text-slate-700 dark:text-white/70 text-sm font-semibold mb-1">Market loaded — no correlations mapped yet</p>
                      <p className="text-slate-400 dark:text-white/30 text-xs leading-relaxed">
                        Try{' '}
                        <button onClick={() => { setQuery('Trump resign'); setSearchOpen(true) }} className="text-green-600 dark:text-green-400 hover:text-green-700 underline">Trump resign</button>
                        {' '}or{' '}
                        <button onClick={() => { setQuery('Fed abolished'); setSearchOpen(true) }} className="text-green-600 dark:text-green-400 hover:text-green-700 underline">Fed abolished</button>
                        {' '}to see a full cascade.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 dark:text-white/30 text-sm">No related markets mapped for this scenario.</p>
                )}
              </div>
            ) : (
              <div className="max-w-7xl mx-auto">
                <div className="hidden sm:grid grid-cols-12 gap-2 px-6 py-2.5 border-b border-slate-200 dark:border-white/[0.05] sticky top-0 bg-[#f7fdf7] dark:bg-[#050505] z-10">
                  <div className="col-span-4 text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 font-semibold">Market</div>
                  <div className="col-span-2 text-center">
                    <Tooltip text="Recommended action — BUY YES if underpriced, BUY NO if overpriced.">
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 cursor-default underline decoration-dotted font-semibold">Trade</span>
                    </Tooltip>
                  </div>
                  <div className="col-span-1 text-right">
                    <Tooltip text="Current market price on Kalshi right now.">
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 cursor-default underline decoration-dotted font-semibold">Now</span>
                    </Tooltip>
                  </div>
                  <div className="col-span-1 text-right">
                    <Tooltip text="Implied fair value if your assumed scenario is correct.">
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 cursor-default underline decoration-dotted font-semibold">Fair</span>
                    </Tooltip>
                  </div>
                  <div className="col-span-2 text-right">
                    <Tooltip text="The gap between fair value and current price. ↑ = underpriced, ↓ = overpriced.">
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 cursor-default underline decoration-dotted font-semibold">Edge</span>
                    </Tooltip>
                  </div>
                  <div className="col-span-1 text-center">
                    <Tooltip text="Confidence based on relationship strength.">
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 cursor-default underline decoration-dotted font-semibold">Signal</span>
                    </Tooltip>
                  </div>
                  <div className="col-span-1 text-right">
                    <Tooltip text="Edge in percentage points. Higher = larger mispricing.">
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 cursor-default underline decoration-dotted font-semibold">Score</span>
                    </Tooltip>
                  </div>
                </div>

                {results.map((result, i) => (
                  <ResultRow key={result.market.id} result={result} rank={i + 1}
                    isExpanded={expandedRow === result.market.id}
                    onToggle={() => setExpandedRow(expandedRow === result.market.id ? null : result.market.id)}
                  />
                ))}

                <div className="border-t border-slate-200 dark:border-white/[0.05] px-6 py-2.5 flex items-center gap-5 text-[10px] text-slate-400 dark:text-white/25 sticky bottom-0 bg-[#f7fdf7] dark:bg-[#050505]">
                  <span>{results.length} markets analyzed</span>
                  <span>Avg edge: <span className="font-mono font-bold text-slate-500 dark:text-white/40">{avgEdge.toFixed(1)}pp</span></span>
                  <span className="hidden sm:inline">Best: <span className={`font-mono font-bold ${results[0].distortion > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{formatDistortion(results[0].distortion)}</span> on <span className="text-slate-400 dark:text-white/30">{results[0].market.title.slice(0, 30)}…</span></span>
                  <div className="ml-auto">
                    <ShareButton targetId="scenario-header" tweetText={tweetText} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Advanced certainty toggle ─────────────────────────────────────────────────
function AdvancedCertainty({ probability, onChange }: { probability: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setOpen(o => !o)}
        className={`text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
          open
            ? 'text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10'
            : 'text-slate-500 dark:text-white/30 border-slate-200 dark:border-white/10 hover:text-slate-700 dark:hover:text-white/60'
        }`}>
        Advanced {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="flex items-center gap-3 min-w-[180px]">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 font-semibold shrink-0">Certainty</span>
          <input type="range" min="1" max="100" value={Math.round(probability * 100)}
            onChange={e => onChange(Number(e.target.value) / 100)}
            className="flex-1 accent-green-500 cursor-pointer" />
          <span className="text-sm font-mono font-black text-green-600 dark:text-green-400 w-10 text-right">{Math.round(probability * 100)}%</span>
        </div>
      )}
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
    emerald: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    red: 'text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/20',
    yellow: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25',
    default: 'text-slate-700 dark:text-white/60 bg-slate-100 dark:bg-white/[0.04] border-slate-200 dark:border-white/10',
  }
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl border ${styles[color ?? 'default']}`}
      style={glow ? { boxShadow: '0 0 16px rgba(251,191,36,0.15)' } : {}}>
      <span className="text-base font-black font-mono leading-none">{value}</span>
      <span className="text-[9px] uppercase tracking-widest mt-0.5 opacity-60 font-semibold">{label}</span>
    </div>
  )
}

// ── Signal strength ───────────────────────────────────────────────────────────
function SignalStrength({ weight }: { weight: number }) {
  const level = weight >= 0.7 ? 'High' : weight >= 0.45 ? 'Med' : 'Low'
  const style = weight >= 0.7
    ? 'text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/20'
    : weight >= 0.45
    ? 'text-slate-600 dark:text-white/50 bg-slate-100 dark:bg-white/[0.04] border-slate-200 dark:border-white/10'
    : 'text-slate-400 dark:text-white/20 bg-transparent border-slate-200 dark:border-white/[0.06]'
  return (
    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border tracking-widest ${style}`}>{level}</span>
  )
}

// ── Result row ────────────────────────────────────────────────────────────────
function ResultRow({ result, rank, isExpanded, onToggle }: {
  result: ScenarioResult; rank: number; isExpanded: boolean; onToggle: () => void
}) {
  const { market, current_probability, implied_probability, distortion, direction, weight, analysis, relationship_type } = result
  const isUp = direction === 'up'
  const isDown = direction === 'down'
  const distColor = isUp ? 'text-emerald-600 dark:text-emerald-400' : isDown ? 'text-red-500 dark:text-red-400' : 'text-slate-400'
  const edgeScore = Math.abs(distortion * 100)
  const isHighEdge = edgeScore > 10

  const tradeLabel = isUp ? 'BUY YES' : isDown ? 'BUY NO' : 'NEUTRAL'
  const tradeBg = isUp
    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
    : isDown
    ? 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25'
    : 'bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-white/30 border-slate-200 dark:border-white/10'

  const leftBorder = isUp ? 'border-l-emerald-500/50' : isDown ? 'border-l-red-500/50' : 'border-l-transparent'
  const rowBg = isExpanded
    ? (isUp ? 'bg-emerald-50 dark:bg-emerald-500/[0.05]' : isDown ? 'bg-red-50 dark:bg-red-500/[0.05]' : 'bg-slate-50 dark:bg-white/[0.02]')
    : (isUp ? 'hover:bg-emerald-50 dark:hover:bg-emerald-500/[0.04]' : isDown ? 'hover:bg-red-50 dark:hover:bg-red-500/[0.04]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]')

  const kalshiTicker = market.external_id

  return (
    <div className={`border-b border-slate-100 dark:border-white/[0.05] border-l-2 ${leftBorder} transition-all ${rowBg}`}>
      <button onClick={onToggle} className="w-full text-left">
        {/* Mobile */}
        <div className="sm:hidden flex items-start gap-3 px-4 py-3.5">
          <span className="text-[10px] text-slate-400 dark:text-white/20 font-mono mt-0.5 shrink-0 w-4 font-bold">{rank}</span>
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm text-slate-700 dark:text-white/80 leading-snug line-clamp-2">{market.title}</p>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border tracking-widest ${tradeBg}`}>{tradeLabel}</span>
              <span className={`text-sm font-mono font-black ${distColor}`}>{isUp ? '↑' : isDown ? '↓' : '→'} {formatDistortion(distortion)}</span>
              <span className="text-xs font-mono text-slate-400 dark:text-white/30 ml-auto">{formatProbability(current_probability)} → <span className={`font-bold ${distColor}`}>{formatProbability(implied_probability)}</span></span>
            </div>
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden sm:grid grid-cols-12 gap-2 px-6 py-3.5">
          <div className="col-span-4 flex items-start gap-2 min-w-0">
            <span className="text-[10px] text-slate-300 dark:text-white/20 font-mono mt-0.5 shrink-0 w-4 font-bold">{rank}</span>
            <p className="text-xs text-slate-600 dark:text-white/70 leading-snug line-clamp-2">{market.title}</p>
          </div>
          <div className="col-span-2 flex items-center justify-center">
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border tracking-widest ${tradeBg}`}>{tradeLabel}</span>
          </div>
          <div className="col-span-1 flex items-center justify-end">
            <span className="text-xs font-mono text-slate-400 dark:text-white/30">{formatProbability(current_probability)}</span>
          </div>
          <div className="col-span-1 flex items-center justify-end">
            <span className={`text-xs font-mono font-bold ${distColor}`}>{formatProbability(implied_probability)}</span>
          </div>
          <div className="col-span-2 flex flex-col items-end justify-center gap-1">
            <span className={`text-sm font-mono font-black ${distColor}`}>
              {isUp ? '↑' : isDown ? '↓' : '→'} {formatDistortion(distortion)}
            </span>
            <div className="w-full h-px bg-slate-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${isUp ? 'bg-emerald-500' : isDown ? 'bg-red-500' : 'bg-slate-400'}`}
                style={{ width: `${Math.min(100, edgeScore * 3)}%`, opacity: 0.8 }} />
            </div>
          </div>
          <div className="col-span-1 flex items-center justify-center">
            <SignalStrength weight={weight} />
          </div>
          <div className="col-span-1 flex items-center justify-end">
            <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${
              edgeScore > 15 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20' :
              edgeScore > 5  ? 'bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-white/50 border-slate-200 dark:border-white/10' :
              'text-slate-300 dark:text-white/20 border-transparent'
            }`}>{edgeScore > 15 ? 'High' : edgeScore > 5 ? 'Med' : 'Low'}</span>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className={`px-4 sm:px-6 pb-5 pt-2 border-t ${isUp ? 'border-emerald-500/10' : isDown ? 'border-red-500/10' : 'border-slate-100 dark:border-white/[0.04]'}`}>
          <div className="ml-0 sm:ml-6 space-y-4">

            <div className={`rounded-xl p-4 border ${isUp ? 'bg-emerald-500/[0.06] border-emerald-500/20' : isDown ? 'bg-red-500/[0.06] border-red-500/20' : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06]'}`}>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${tradeBg}`}>{tradeLabel}</span>
                  <span className="text-[10px] text-slate-400 dark:text-white/25 uppercase tracking-widest font-semibold">Trade thesis</span>
                </div>
                <KalshiLink ticker={kalshiTicker}
                  className="text-[10px] text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1 transition-colors">
                  Trade on Kalshi
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </KalshiLink>
              </div>
              <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
                {isUp
                  ? `Market is at ${formatProbability(current_probability)}. Fair value given this scenario is ~${formatProbability(implied_probability)} — ${formatDistortion(distortion)} higher. Appears underpriced. Consider buying YES.`
                  : isDown
                  ? `Market is at ${formatProbability(current_probability)}. Fair value given this scenario is ~${formatProbability(implied_probability)} — ${formatDistortion(Math.abs(distortion))} lower. Appears overpriced. Consider buying NO.`
                  : `This market is unlikely to move significantly given this scenario.`
                }
              </p>
            </div>

            <div className="rounded-xl p-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/25 mb-2 font-semibold">Why it moves</p>
              <p className="text-xs text-slate-600 dark:text-white/50 leading-relaxed">{analysis}</p>
            </div>

            <div className="rounded-xl px-4 py-3 bg-slate-50 dark:bg-transparent border border-slate-100 dark:border-white/[0.04]">
              <p className="text-xs text-slate-500 dark:text-white/30 leading-relaxed">
                <span className={`font-bold capitalize ${relationship_type === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : relationship_type === 'negative' ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-white/50'}`}>
                  {relationship_type === 'positive' ? 'Positive' : relationship_type === 'negative' ? 'Negative' : 'Neutral'} correlation
                </span>
                {' '}at <span className="font-bold text-slate-700 dark:text-white/60">{(weight * 100).toFixed(0)}% confidence</span>
                {' — '}{weight >= 0.7 ? 'high conviction signal' : weight >= 0.45 ? 'moderate signal' : 'low conviction signal'}.
                {' '}<span className={`font-bold ${isHighEdge ? 'text-amber-600 dark:text-amber-300' : 'text-slate-500 dark:text-white/40'}`}>{edgeScore.toFixed(1)}pp edge</span>
                {isHighEdge ? ' — notable mispricing opportunity.' : '.'}
              </p>
            </div>

            <ScenarioSparkline ticker={market.external_id} isUp={isUp} isDown={isDown} />

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/25 font-semibold">Probability shift</p>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 dark:text-white/30 w-12 text-right">{formatProbability(current_probability)}</span>
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/[0.06] rounded-full relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-slate-300 dark:bg-white/10 rounded-full" style={{ width: `${current_probability * 100}%` }} />
                  <div className={`absolute inset-y-0 left-0 rounded-full opacity-80 ${isUp ? 'bg-emerald-500' : isDown ? 'bg-red-500' : 'bg-slate-400'}`}
                    style={{ width: `${implied_probability * 100}%` }} />
                </div>
                <span className={`text-xs font-mono font-black w-12 ${distColor}`}>{formatProbability(implied_probability)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-12" />
                <div className="flex-1 flex justify-between text-[10px] text-slate-300 dark:text-white/15">
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

// ── Scenario row sparkline ────────────────────────────────────────────────────
function ScenarioSparkline({ ticker, isUp, isDown }: {
  ticker: string; isUp: boolean; isDown: boolean
}) {
  const [prices, setPrices] = useState<number[] | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const loaded = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loaded.current) {
        loaded.current = true
        fetch(`/api/markets/history?ticker=${encodeURIComponent(ticker)}`)
          .then(r => r.json())
          .then(d => setPrices(d.prices?.length >= 2 ? d.prices : []))
          .catch(() => setPrices([]))
      }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [ticker])

  const lineColor = isUp ? '#22c55e' : isDown ? '#ef4444' : '#94a3b8'
  const pts = prices ?? []
  const W = 300; const H = 44
  const min = pts.length ? Math.min(...pts) : 0
  const max = pts.length ? Math.max(...pts) : 1
  const range = max - min || 0.01
  const points = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * W
    const y = H - ((p - min) / range) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const fillPath = pts.length >= 2
    ? `M ${points.split(' ')[0]} L ${points} L ${W},${H} L 0,${H} Z`
    : ''
  const fillId = `sf-${ticker.replace(/[^a-z0-9]/gi, '')}`

  return (
    <div ref={ref} className="rounded-xl border border-slate-100 dark:border-white/[0.05] overflow-hidden">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/25 font-semibold px-4 pt-3 pb-1">7-day price history</p>
      <div className="px-1 pb-1">
        {prices === null ? (
          <div className="w-full h-11 bg-slate-50 dark:bg-white/[0.02] animate-pulse rounded-lg" />
        ) : pts.length < 2 ? (
          <div className="w-full h-11 flex items-center justify-center">
            <span className="text-[10px] text-slate-300 dark:text-white/15">No chart data</span>
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-11">
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.12" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={fillPath} fill={`url(#${fillId})`} />
            <polyline points={points} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={W} cy={parseFloat(points.split(' ').pop()!.split(',')[1])} r="2.5" fill={lineColor} />
          </svg>
        )}
      </div>
      {pts.length >= 2 && (
        <div className="flex items-center justify-between px-4 pb-2.5 text-[10px] font-mono">
          <span className="text-slate-400 dark:text-white/20">{(pts[0] * 100).toFixed(1)}%</span>
          <span className={`font-bold ${isUp ? 'text-emerald-500' : isDown ? 'text-red-500' : 'text-slate-400'}`}>{(pts[pts.length - 1] * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}

// ── News ticker ──────────────────────────────────────────────────────────────
interface Headline { title: string; url: string; source: string; publishedAt: string }

function NewsTicker() {
  const [headlines, setHeadlines] = useState<Headline[]>([])

  useEffect(() => {
    fetch('/api/news')
      .then(r => r.json())
      .then(d => setHeadlines(d.headlines ?? []))
      .catch(() => {})
  }, [])

  if (headlines.length === 0) return null

  const items = [...headlines, ...headlines]

  return (
    <div className="w-full flex items-center bg-white/50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/[0.06]">
      <div className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 border-r border-slate-200 dark:border-white/[0.06] bg-green-50 dark:bg-green-500/[0.07]">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
        <span className="text-[10px] uppercase tracking-widest font-black text-green-700 dark:text-green-400 whitespace-nowrap">Trending News</span>
      </div>
      <div className="flex-1 overflow-hidden py-2.5 pl-4">
        <div className="flex gap-8 w-max animate-[ticker_40s_linear_infinite]" style={{ willChange: 'transform' }}>
          {items.map((h, i) => (
            <a
              key={i}
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 shrink-0 group"
            >
              <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20 shrink-0">
                {h.source}
              </span>
              <span className="text-xs text-slate-600 dark:text-white/50 group-hover:text-green-700 dark:group-hover:text-white transition-colors font-medium max-w-xs truncate">
                {h.title}
              </span>
              <span className="text-[10px] text-green-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Trending Right Now chips ──────────────────────────────────────────────────
interface TrendingMarket { ticker: string; title: string; volume_24h: number }

function TrendingChips({ onSearch }: { onSearch: (q: string) => void }) {
  const [markets, setMarkets] = useState<TrendingMarket[]>([])

  useEffect(() => {
    fetch('/api/markets/top')
      .then(r => r.json())
      .then(d => setMarkets((d.markets ?? []).slice(0, 4)))
      .catch(() => {})
  }, [])

  if (markets.length === 0) return null

  function fmtVol(v: number) {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
    return `$${v}`
  }

  return (
    <div className="mb-6">
      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 dark:text-white/20 mb-3 font-semibold text-center">
        🔥 Trending Right Now
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {markets.map(m => (
          <button
            key={m.ticker}
            onClick={() => onSearch(m.title)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] hover:border-green-400 dark:hover:border-green-500/40 hover:bg-green-50 dark:hover:bg-white/[0.09] transition-all group text-left"
          >
            <span className="text-xs font-medium text-slate-700 dark:text-white/60 group-hover:text-green-700 dark:group-hover:text-white transition-colors max-w-[180px] truncate">
              {m.title}
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20 shrink-0">
              {fmtVol(m.volume_24h)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Example scenario cards ────────────────────────────────────────────────────
function ExampleCards({ onSearch }: { onSearch: (q: string) => void }) {
  const examples = [
    { q: 'Trump resign', scenario: 'YES', impact: '↓ GOP 2028  ↑ Impeach odds', icon: '🏛️' },
    { q: 'Fed abolished', scenario: 'NO', impact: '→ Debt ceiling  fiscal markets', icon: '📈' },
    { q: 'China trade deal', scenario: 'YES', impact: '↓ GDP gap  ↑ Manufacturing', icon: '🌐' },
    { q: 'Taiwan', scenario: 'YES', impact: '↑ Level 4 advisory issued', icon: '⚔️' },
  ]
  return (
    <div className="pb-12 px-6">
      <div className="max-w-xl mx-auto">
        <TrendingChips onSearch={onSearch} />

        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 dark:text-white/20 mb-4 font-semibold text-center">Example scenarios</p>
        <div className="grid grid-cols-2 gap-2.5">
          {examples.map(ex => (
            <button key={ex.q} onClick={() => onSearch(ex.q)}
              className="text-left p-4 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] hover:border-green-400 dark:hover:border-green-500/30 hover:bg-green-50 dark:hover:bg-white/[0.07] transition-all group">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">{ex.icon}</span>
                <div className="flex-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-700 dark:text-white/70 group-hover:text-green-700 dark:group-hover:text-white transition-colors">{ex.q}</p>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest shrink-0 ${
                    ex.scenario === 'YES'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20'
                  }`}>{ex.scenario}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-white/25 font-mono">{ex.impact}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-6 text-[10px] text-slate-400 dark:text-white/20 mt-6 font-medium">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Underpriced → BUY YES</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" /> Overpriced → BUY NO</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Score = edge in pp</span>
        </div>
      </div>
    </div>
  )
}
