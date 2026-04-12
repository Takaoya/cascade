'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ShareButton } from '@/components/ShareButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import type { Market, ScenarioResult } from '@/lib/probability'
import { formatProbability, formatDistortion } from '@/lib/probability'

// ── KalshiLink ───────────────────────────────────────────────────────────────
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
      const slug = ticker.replace(/-(?:YES|NO)$/i, '').replace(/-\d{2}[A-Z0-9]*$/i, '').toUpperCase()
      window.open(`https://kalshi.com/markets/${slug}`, '_blank', 'noopener,noreferrer')
    }
  }
  return <button onClick={handleClick} className={className}>{children}</button>
}

// ── Page ─────────────────────────────────────────────────────────────────────
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
  const [exampleMarkets, setExampleMarkets] = useState<Market[]>([])

  // Fetch markets with the most mapped relationships — these are guaranteed
  // to produce results when clicked.
  useEffect(() => {
    fetch('/api/markets/featured')
      .then(r => r.json())
      .then(d => setExampleMarkets((d.markets ?? []).slice(0, 5) as Market[]))
      .catch(() => {})
  }, [])

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
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false)
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
  const assumedTicker = assumedMarket?.external_id ?? null

  return (
    <div className="h-screen flex flex-col bg-[#0b0b0b] text-white font-sans overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="h-11 flex items-center justify-between px-4 border-b border-white/[0.07] shrink-0 bg-[#0b0b0b]">
        <div className="flex items-center gap-3">
          <a href="/" className="text-xs font-black tracking-[0.25em] uppercase text-white/80 hover:text-white transition-colors">CASCADE</a>
          <span className="text-white/20">/</span>
          <span className="text-xs text-white/50 font-medium">Scenario Analysis</span>
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <span className="text-[10px] font-mono text-white/40">Kalshi · Live</span>
          </div>
          <a href="/top" className="text-xs text-white/45 hover:text-white/75 transition-colors">Market Movers</a>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL: Scenario builder ──────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-r border-white/[0.07] flex flex-col overflow-y-auto bg-[#0e0e0e]">

          {/* Panel label */}
          <div className="px-4 py-2.5 border-b border-white/[0.07]">
            <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-semibold">Assumption Builder</p>
          </div>

          <div className="flex-1 p-4 space-y-5">

            {/* ── Market search ── */}
            <div>
              <label className="text-[9px] uppercase tracking-[0.18em] text-white/45 font-semibold block mb-2">Market</label>
              <div ref={searchRef} className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={e => { handleInputChange(e.target.value); setSearchOpen(true) }}
                  onFocus={() => markets.length > 0 && setSearchOpen(true)}
                  placeholder="Search or paste Kalshi URL…"
                  className={`w-full bg-white/[0.04] border rounded-md px-3 py-2.5 text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none transition-colors ${
                    urlError
                      ? 'border-red-500/40 focus:border-red-500/60'
                      : 'border-white/[0.09] focus:border-green-500/50 focus:bg-white/[0.05]'
                  }`}
                />
                {(searching || urlLoading) ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border border-white/15 border-t-green-500 rounded-full animate-spin" />
                ) : assumedMarket ? (
                  <button
                    onClick={() => { setAssumedMarket(null); setResults([]); setQuery(''); setExpandedRow(null) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors text-lg leading-none"
                  >×</button>
                ) : null}

                {/* Dropdown */}
                {searchOpen && markets.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#141414] border border-white/[0.09] rounded-md shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                    {markets.map(market => (
                      <button key={market.id} onClick={() => handleSelect(market)}
                        className="w-full text-left px-3 py-2.5 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.04] transition-colors group">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[12px] text-white/50 group-hover:text-white/80 transition-colors line-clamp-2 leading-relaxed flex-1">{market.title}</p>
                          <span className="text-[12px] font-mono font-bold text-white/70 shrink-0 mt-0.5">{formatProbability(market.probability)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {urlError && <p className="mt-1.5 text-[11px] text-red-400">{urlError}</p>}
              </div>
            </div>

            {/* ── YES / NO ── */}
            <div>
              <label className="text-[9px] uppercase tracking-[0.18em] text-white/45 font-semibold block mb-2">Assumed Resolution</label>
              <div className="flex h-9 rounded-md overflow-hidden border border-white/[0.09]">
                <button
                  onClick={() => handleResolutionToggle(true)}
                  disabled={!assumedMarket}
                  className={`flex-1 text-[11px] font-black tracking-widest transition-colors disabled:opacity-25 disabled:cursor-not-allowed ${
                    resolvesYes
                      ? 'bg-green-600 text-white'
                      : 'text-white/25 hover:text-white/50 hover:bg-white/[0.03]'
                  }`}
                >YES</button>
                <div className="w-px bg-white/[0.09]" />
                <button
                  onClick={() => handleResolutionToggle(false)}
                  disabled={!assumedMarket}
                  className={`flex-1 text-[11px] font-black tracking-widest transition-colors disabled:opacity-25 disabled:cursor-not-allowed ${
                    !resolvesYes
                      ? 'bg-red-600 text-white'
                      : 'text-white/25 hover:text-white/50 hover:bg-white/[0.03]'
                  }`}
                >NO</button>
              </div>
            </div>

            {/* ── Certainty ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[9px] uppercase tracking-[0.18em] text-white/45 font-semibold">Certainty</label>
                <span className="text-[11px] font-mono text-white/65">{Math.round(assumedProbability * 100)}%</span>
              </div>
              <input
                type="range" min="1" max="100"
                value={Math.round(assumedProbability * 100)}
                onChange={e => handleCertaintyChange(Number(e.target.value) / 100)}
                disabled={!assumedMarket}
                className="w-full h-1 accent-green-500 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] font-mono text-white/30">Weak</span>
                <span className="text-[9px] font-mono text-white/30">Certain</span>
              </div>
            </div>

            {/* ── Assumed market card ── */}
            {assumedMarket ? (
              <div className="rounded-md border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold">Selected Market</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded tracking-widest ml-auto ${
                    resolvesYes
                      ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                      : 'bg-red-500/15 text-red-400 border border-red-500/20'
                  }`}>{resolvesYes ? 'YES' : 'NO'}</span>
                </div>
                <div className="px-3 py-2.5 space-y-2">
                  <p className="text-[12px] text-white/80 leading-relaxed">{assumedMarket.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40">Current price</span>
                    <span className="text-[11px] font-mono font-bold text-white/70">{formatProbability(assumedMarket.probability)}</span>
                  </div>
                  {assumedTicker && (
                    <KalshiLink ticker={assumedTicker}
                      className="w-full mt-0.5 py-1.5 text-[10px] font-semibold text-green-400/70 border border-green-500/15 rounded hover:bg-green-500/10 hover:text-green-400 transition-colors tracking-wide text-center">
                      View on Kalshi ↗
                    </KalshiLink>
                  )}
                </div>
              </div>
            ) : (
              /* ── Quick examples (empty state) ── */
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-semibold mb-2">Try an example</p>
                {exampleMarkets.length === 0 ? (
                  <div className="space-y-1.5">
                    {[1,2,3].map(i => (
                      <div key={i} className="h-9 rounded border border-white/[0.06] bg-white/[0.02] animate-pulse" />
                    ))}
                  </div>
                ) : exampleMarkets.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleSelect(m)}
                    className="w-full text-left px-3 py-2.5 rounded border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.15] transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-white/60 group-hover:text-white/85 transition-colors leading-snug line-clamp-1 flex-1">{m.title}</span>
                      <span className="text-[11px] font-mono text-white/30 shrink-0">{formatProbability(m.probability)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Bottom metadata ── */}
          <div className="px-4 py-3 border-t border-white/[0.07] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white/35 font-mono">Data source</span>
              <span className="text-[9px] text-white/50 font-mono">Kalshi Trade API v2</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white/35 font-mono">Markets indexed</span>
              <span className="text-[9px] text-white/50 font-mono">13,200+</span>
            </div>
          </div>
        </aside>

        {/* ── RIGHT PANEL: Results ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Results bar */}
          <div className="h-11 flex items-center justify-between px-4 border-b border-white/[0.07] shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/25 font-semibold shrink-0">Cross-Market Mispricing</p>
              {results.length > 0 && !loading && (
                <div className="flex items-center gap-3 text-[10px] text-white/25 font-mono">
                  <span><span className="text-white/50">{results.length}</span> signals</span>
                  <span className="text-white/[0.12]">·</span>
                  <span><span className="text-green-400/80">{upCount}</span> buy YES</span>
                  <span className="text-white/[0.12]">·</span>
                  <span><span className="text-red-400/80">{downCount}</span> buy NO</span>
                  <span className="text-white/[0.12]">·</span>
                  <span>max edge <span className="text-amber-400/80">{maxEdge.toFixed(1)}pp</span></span>
                </div>
              )}
            </div>
            {results.length > 0 && !loading && (
              <div className="shrink-0">
                <ShareButton targetId="results-panel" tweetText={tweetText} />
              </div>
            )}
          </div>

          {/* Results body */}
          <div id="results-panel" className="flex-1 overflow-y-auto">
            {!assumedMarket ? (
              <EmptyState onSearch={q => { setQuery(q); setSearchOpen(true) }} />
            ) : loading ? (
              <div className="flex items-center justify-center h-full gap-3">
                <div className="w-4 h-4 border border-white/10 border-t-green-500 rounded-full animate-spin" />
                <span className="text-[11px] text-white/25 tracking-widest uppercase font-mono">Computing cascade…</span>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
                {noRelationships ? (
                  <div className="text-center max-w-sm space-y-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-sm font-bold mx-auto">!</div>
                    <p className="text-sm text-white/40 font-medium">No correlations mapped for this market</p>
                    <p className="text-[11px] text-white/20 leading-relaxed">
                      Select one of the example markets in the left panel to see a full cascade.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-white/25">No related markets found for this scenario.</p>
                )}
              </div>
            ) : (
              <ResultsTable
                results={results}
                expandedRow={expandedRow}
                onToggle={id => setExpandedRow(expandedRow === id ? null : id)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onSearch }: { onSearch: (q: string) => void }) {
  const [trending, setTrending] = useState<{ ticker: string; title: string; volume_24h: number; probability: number }[]>([])

  useEffect(() => {
    fetch('/api/markets/top')
      .then(r => r.json())
      .then(d => setTrending((d.markets ?? []).slice(0, 6)))
      .catch(() => {})
  }, [])

  function fmtVol(v: number) {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
    return `$${v}`
  }

  return (
    <div className="max-w-xl mx-auto px-6 pt-10 pb-16 space-y-8">

      {/* How it works */}
      <div>
        <p className="text-[9px] uppercase tracking-[0.2em] text-white/20 font-semibold mb-3">How it works</p>
        <div className="border border-white/[0.07] rounded-md overflow-hidden">
          {[
            { n: '01', title: 'Select a market', desc: 'Search any Kalshi market by name or paste a URL directly.' },
            { n: '02', title: 'Set assumption', desc: 'Choose YES or NO. Adjust certainty with the slider if needed.' },
            { n: '03', title: 'Ranked opportunity set', desc: 'Every correlated market sorted by mispricing edge, largest first.' },
          ].map((s, i) => (
            <div key={s.n} className={`flex items-start gap-4 px-4 py-3 ${i < 2 ? 'border-b border-white/[0.07]' : ''}`}>
              <span className="text-[10px] font-mono text-white/15 mt-px shrink-0">{s.n}</span>
              <div>
                <p className="text-[12px] font-semibold text-white/50">{s.title}</p>
                <p className="text-[11px] text-white/25 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trending */}
      {trending.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/20 font-semibold mb-3">Trending on Kalshi</p>
          <div className="border border-white/[0.07] rounded-md overflow-hidden">
            {trending.map((m, i) => (
              <button
                key={m.ticker}
                onClick={() => onSearch(m.title)}
                className={`w-full text-left flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-white/[0.03] transition-colors group ${
                  i < trending.length - 1 ? 'border-b border-white/[0.05]' : ''
                }`}
              >
                <span className="text-[12px] text-white/40 group-hover:text-white/70 transition-colors line-clamp-1 flex-1">{m.title}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono text-white/25">{(m.probability * 100).toFixed(0)}%</span>
                  <span className="text-[10px] font-mono text-white/20">{fmtVol(m.volume_24h)} vol</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Results table ─────────────────────────────────────────────────────────────
function ResultsTable({ results, expandedRow, onToggle }: {
  results: ScenarioResult[]
  expandedRow: string | null
  onToggle: (id: string) => void
}) {
  return (
    <div>
      {/* Column headers */}
      <div className="hidden sm:grid grid-cols-[2.5rem_1fr_5.5rem_5.5rem_7rem_4.5rem_6rem] gap-x-3 px-4 py-2 border-b border-white/[0.07] sticky top-0 bg-[#0b0b0b] z-10">
        <div className="text-[9px] uppercase tracking-widest text-white/20 font-semibold">#</div>
        <div className="text-[9px] uppercase tracking-widest text-white/20 font-semibold">Market</div>
        <div className="text-[9px] uppercase tracking-widest text-white/20 font-semibold text-right">Current</div>
        <div className="text-[9px] uppercase tracking-widest text-white/20 font-semibold text-right">Implied</div>
        <div className="text-[9px] uppercase tracking-widest text-white/20 font-semibold text-right">Edge</div>
        <div className="text-[9px] uppercase tracking-widest text-white/20 font-semibold text-center">Signal</div>
        <div className="text-[9px] uppercase tracking-widest text-white/20 font-semibold text-right">Action</div>
      </div>

      {results.map((result, i) => (
        <ResultRow
          key={result.market.id}
          result={result}
          rank={i + 1}
          isExpanded={expandedRow === result.market.id}
          onToggle={() => onToggle(result.market.id)}
        />
      ))}
    </div>
  )
}

// ── Result row ────────────────────────────────────────────────────────────────
function ResultRow({ result, rank, isExpanded, onToggle }: {
  result: ScenarioResult
  rank: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const { market, current_probability, implied_probability, distortion, direction, weight, analysis, relationship_type } = result
  const isUp = direction === 'up'
  const isDown = direction === 'down'
  const edgeScore = Math.abs(distortion * 100)
  const edgeColor = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white/25'
  const signalLevel = weight >= 0.7 ? 'HIGH' : weight >= 0.45 ? 'MED' : 'LOW'
  const signalColor = weight >= 0.7 ? 'text-green-400/80' : weight >= 0.45 ? 'text-white/35' : 'text-white/18'
  const tradeLabel = isUp ? 'BUY YES' : isDown ? 'BUY NO' : 'HOLD'
  const tradeBg = isUp
    ? 'bg-green-500/10 text-green-400 border-green-500/20'
    : isDown
    ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : 'bg-white/[0.03] text-white/20 border-white/[0.07]'
  const kalshiTicker = market.external_id

  const rowBg = isExpanded
    ? (isUp ? 'bg-green-500/[0.04]' : isDown ? 'bg-red-500/[0.03]' : 'bg-white/[0.02]')
    : (isUp ? 'hover:bg-green-500/[0.03]' : isDown ? 'hover:bg-red-500/[0.02]' : 'hover:bg-white/[0.02]')

  return (
    <div className={`border-b border-white/[0.05] transition-colors ${rowBg}`}>

      {/* Main row — desktop */}
      <button onClick={onToggle} className="w-full text-left hidden sm:block">
        <div className="grid grid-cols-[2.5rem_1fr_5.5rem_5.5rem_7rem_4.5rem_6rem] gap-x-3 px-4 py-3 items-center">
          <span className="text-[10px] font-mono text-white/18">{rank}</span>

          <p className="text-[12px] text-white/60 leading-snug line-clamp-1 pr-2">{market.title}</p>

          <span className="text-[12px] font-mono text-white/35 text-right block">{formatProbability(current_probability)}</span>

          <span className={`text-[12px] font-mono font-bold text-right block ${edgeColor}`}>
            {formatProbability(implied_probability)}
          </span>

          <div className="space-y-1">
            <div className="flex items-center justify-end">
              <span className={`text-[12px] font-mono font-black ${edgeColor}`}>
                {isUp ? '+' : isDown ? '−' : ''}{edgeScore.toFixed(1)}pp
              </span>
            </div>
            <div className="h-[2px] w-full bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isUp ? 'bg-green-500' : isDown ? 'bg-red-500' : 'bg-white/20'}`}
                style={{ width: `${Math.min(100, edgeScore * 5)}%`, opacity: 0.7 }}
              />
            </div>
          </div>

          <div className="text-center">
            <span className={`text-[9px] font-black tracking-widest ${signalColor}`}>{signalLevel}</span>
          </div>

          <div className="flex justify-end">
            <span className={`text-[9px] font-black px-2 py-0.5 rounded border tracking-widest ${tradeBg}`}>{tradeLabel}</span>
          </div>
        </div>
      </button>

      {/* Main row — mobile */}
      <button onClick={onToggle} className="w-full text-left sm:hidden">
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="text-[10px] font-mono text-white/18 mt-0.5 w-5 shrink-0">{rank}</span>
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-[12px] text-white/60 leading-snug line-clamp-2">{market.title}</p>
            <div className="flex items-center gap-2.5">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded border tracking-widest ${tradeBg}`}>{tradeLabel}</span>
              <span className={`text-[12px] font-mono font-black ${edgeColor}`}>
                {isUp ? '+' : isDown ? '−' : ''}{edgeScore.toFixed(1)}pp
              </span>
              <span className="text-[11px] font-mono text-white/25 ml-auto">
                {formatProbability(current_probability)} → <span className={`font-bold ${edgeColor}`}>{formatProbability(implied_probability)}</span>
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0.5 border-t border-white/[0.05]">
          <div className="sm:ml-9 space-y-3">

            {/* Probability bar */}
            <div>
              <p className="text-[9px] uppercase tracking-widest text-white/18 font-semibold mb-2">Probability Shift</p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-white/30 w-11 text-right">{formatProbability(current_probability)}</span>
                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-white/[0.08] rounded-full" style={{ width: `${current_probability * 100}%` }} />
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${isUp ? 'bg-green-500' : isDown ? 'bg-red-500' : 'bg-white/20'}`}
                    style={{ width: `${implied_probability * 100}%`, opacity: 0.65 }}
                  />
                </div>
                <span className={`text-[10px] font-mono font-bold w-11 ${edgeColor}`}>{formatProbability(implied_probability)}</span>
              </div>
            </div>

            {/* Analysis grid */}
            <div className="grid sm:grid-cols-2 gap-2.5">
              <div className="rounded-md p-3 bg-white/[0.03] border border-white/[0.07]">
                <p className="text-[9px] uppercase tracking-widest text-white/18 font-semibold mb-2">Trade Thesis</p>
                <p className="text-[11px] text-white/45 leading-relaxed">
                  {isUp
                    ? `Market is priced at ${formatProbability(current_probability)}. Implied fair value given this scenario is ${formatProbability(implied_probability)} — a ${formatDistortion(distortion)} underpricing. Consider buying YES.`
                    : isDown
                    ? `Market is priced at ${formatProbability(current_probability)}. Implied fair value given this scenario is ${formatProbability(implied_probability)} — a ${formatDistortion(Math.abs(distortion))} overpricing. Consider buying NO.`
                    : `Minimal expected movement under this scenario.`
                  }
                </p>
              </div>
              <div className="rounded-md p-3 bg-white/[0.03] border border-white/[0.07]">
                <p className="text-[9px] uppercase tracking-widest text-white/18 font-semibold mb-2">Correlation Logic</p>
                <p className="text-[11px] text-white/45 leading-relaxed">{analysis}</p>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.05]">
                  <span className={`text-[9px] font-semibold capitalize ${
                    relationship_type === 'positive' ? 'text-green-400/70'
                    : relationship_type === 'negative' ? 'text-red-400/70'
                    : 'text-white/25'
                  }`}>
                    {relationship_type === 'positive' ? 'Positive' : relationship_type === 'negative' ? 'Negative' : 'Neutral'} correlation
                  </span>
                  <span className="text-white/[0.12]">·</span>
                  <span className="text-[9px] font-mono text-white/25">{(weight * 100).toFixed(0)}% confidence</span>
                  <span className="text-white/[0.12]">·</span>
                  <span className={`text-[9px] font-mono ${edgeScore > 10 ? 'text-amber-400/70' : 'text-white/25'}`}>{edgeScore.toFixed(1)}pp edge</span>
                </div>
              </div>
            </div>

            {/* Sparkline + Trade link */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <ScenarioSparkline ticker={market.external_id} isUp={isUp} isDown={isDown} />
              </div>
              <KalshiLink ticker={kalshiTicker}
                className="shrink-0 mb-0.5 text-[10px] font-semibold text-green-400/60 border border-green-500/15 rounded px-3 py-2 hover:bg-green-500/10 hover:text-green-400 transition-colors">
                Trade on Kalshi ↗
              </KalshiLink>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
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

  const lineColor = isUp ? '#22c55e' : isDown ? '#ef4444' : '#475569'
  const pts = prices ?? []
  const W = 300; const H = 40
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
    <div ref={ref} className="rounded-md border border-white/[0.07] overflow-hidden bg-white/[0.02]">
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <p className="text-[9px] uppercase tracking-widest text-white/18 font-semibold">7-day price history</p>
        {pts.length >= 2 && (
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="text-white/25">{(pts[0] * 100).toFixed(1)}%</span>
            <span className="text-white/[0.12]">→</span>
            <span className={`font-bold ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white/35'}`}>
              {(pts[pts.length - 1] * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      <div className="px-1 pb-1">
        {prices === null ? (
          <div className="w-full h-10 bg-white/[0.02] animate-pulse rounded" />
        ) : pts.length < 2 ? (
          <div className="w-full h-10 flex items-center justify-center">
            <span className="text-[10px] text-white/15 font-mono">No data</span>
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-10">
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.1" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={fillPath} fill={`url(#${fillId})`} />
            <polyline points={points} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={W} cy={parseFloat(points.split(' ').pop()!.split(',')[1])} r="2" fill={lineColor} />
          </svg>
        )}
      </div>
    </div>
  )
}
