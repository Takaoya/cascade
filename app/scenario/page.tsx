'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShareButton } from '@/components/ShareButton'
import type { Market, ScenarioResult } from '@/lib/probability'
import { formatProbability, formatDistortion } from '@/lib/probability'

export default function ScenarioPage() {
  const [query, setQuery] = useState('')
  const [markets, setMarkets] = useState<Market[]>([])
  const [searching, setSearching] = useState(false)

  const [assumedMarket, setAssumedMarket] = useState<Market | null>(null)
  const [assumedProbability, setAssumedProbability] = useState(1.0)
  const [resolvesYes, setResolvesYes] = useState(true)
  const [results, setResults] = useState<ScenarioResult[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    if (!query || query.length < 2) { setMarkets([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/markets?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setMarkets(data.markets ?? [])
      } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const runScenario = useCallback(async (market: Market, prob: number, yes: boolean) => {
    setLoading(true)
    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assumed_market_id: market.id,
          assumed_probability: prob,
          resolves_yes: yes,
        }),
      })
      const data = await res.json()
      setResults(data.results ?? [])
    } finally { setLoading(false) }
  }, [])

  const handleSelect = (market: Market) => {
    setAssumedMarket(market)
    setQuery(market.title)
    setMarkets([])
    setResolvesYes(true)
    runScenario(market, assumedProbability, true)
  }

  const handleCertaintyChange = (val: number) => {
    setAssumedProbability(val)
    if (assumedMarket) runScenario(assumedMarket, val, resolvesYes)
  }

  const handleResolutionToggle = (yes: boolean) => {
    setResolvesYes(yes)
    if (assumedMarket) runScenario(assumedMarket, assumedProbability, yes)
  }

  const tweetText = assumedMarket
    ? `If "${assumedMarket.title}" resolves ${resolvesYes ? 'YES' : 'NO'} — these Kalshi markets are mispriced via @CascadeMarkets`
    : ''

  const upCount = results.filter(r => r.direction === 'up').length
  const downCount = results.filter(r => r.direction === 'down').length

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans">

      {/* Top bar */}
      <header className="border-b border-zinc-800/60 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-widest text-white uppercase">Cascade</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">Beta</span>
        </div>
        <span className="text-xs text-zinc-600">Kalshi · Conditional Probability Engine</span>
      </header>

      <div className="flex h-[calc(100vh-49px)]">

        {/* LEFT PANEL */}
        <div className="w-72 shrink-0 border-r border-zinc-800/60 flex flex-col">
          <div className="p-4 border-b border-zinc-800/40">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Search markets</p>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Trump, Fed, China..."
                className="w-full bg-zinc-900 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/70 transition-colors"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
              )}
            </div>
          </div>

          {/* Results */}
          {markets.length > 0 ? (
            <div className="flex-1 overflow-y-auto">
              {markets.map(market => (
                <button
                  key={market.id}
                  onClick={() => handleSelect(market)}
                  className="w-full text-left px-4 py-3 border-b border-zinc-800/40 hover:bg-zinc-800/40 transition-colors group"
                >
                  <p className="text-xs text-zinc-300 leading-snug group-hover:text-white transition-colors line-clamp-2">{market.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-zinc-600 uppercase">{market.source}</span>
                    <span className="text-[10px] font-mono text-indigo-400">{formatProbability(market.probability)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 p-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Suggested</p>
              {['Trump resign', 'Impeach', 'Fed abolished', 'China trade deal', 'Taiwan', 'Zelenskyy'].map(hint => (
                <button key={hint} onClick={() => setQuery(hint)}
                  className="block w-full text-left text-xs text-zinc-500 hover:text-zinc-300 py-1.5 transition-colors">
                  → {hint}
                </button>
              ))}
            </div>
          )}

          {/* Controls when market selected */}
          {assumedMarket && (
            <div className="p-4 border-t border-zinc-800/60 space-y-4 bg-zinc-900/20">
              {/* YES / NO toggle */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Resolves</p>
                <div className="flex rounded-lg overflow-hidden border border-zinc-700/50">
                  <button
                    onClick={() => handleResolutionToggle(true)}
                    className={`flex-1 py-2 text-xs font-semibold transition-all ${
                      resolvesYes
                        ? 'bg-emerald-500/20 text-emerald-400 border-r border-emerald-500/30'
                        : 'text-zinc-500 hover:text-zinc-300 border-r border-zinc-700/50'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    onClick={() => handleResolutionToggle(false)}
                    className={`flex-1 py-2 text-xs font-semibold transition-all ${
                      !resolvesYes
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>

              {/* Certainty slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500">Certainty</p>
                  <span className="text-xs font-mono text-indigo-400">{Math.round(assumedProbability * 100)}%</span>
                </div>
                <input
                  type="range" min="1" max="100"
                  value={Math.round(assumedProbability * 100)}
                  onChange={e => handleCertaintyChange(Number(e.target.value) / 100)}
                  className="w-full accent-indigo-500"
                />
                <p className="text-[10px] text-zinc-700 mt-1">Partial probability modeling</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {!assumedMarket ? (
            <EmptyState />
          ) : (
            <>
              {/* Assumed event header */}
              <div id="scenario-output" className="border-b border-zinc-800/60 px-6 py-4 bg-zinc-900/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500">If this market resolves</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        resolvesYes
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30'
                      }`}>
                        {resolvesYes ? 'YES' : 'NO'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white leading-snug">{assumedMarket.title}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                      <span>Market: <span className="font-mono text-zinc-300">{formatProbability(assumedMarket.probability)}</span></span>
                      <span>Certainty: <span className="font-mono text-indigo-400">{Math.round(assumedProbability * 100)}%</span></span>
                      {results.length > 0 && (
                        <>
                          <span className="text-emerald-400">↑ {upCount} markets</span>
                          <span className="text-red-400">↓ {downCount} markets</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ShareButton targetId="scenario-output" tweetText={tweetText} />
                    <button
                      onClick={() => { setAssumedMarket(null); setResults([]); setQuery(''); setExpandedRow(null) }}
                      className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700/50 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Results table */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-48 gap-2 text-zinc-500 text-sm">
                    <div className="w-4 h-4 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
                    Computing cascade...
                  </div>
                ) : results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-2">
                    <p className="text-zinc-500 text-sm">No related markets mapped yet.</p>
                    <p className="text-zinc-700 text-xs">Relationships for this market haven't been seeded.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-12 gap-4 px-6 py-2 border-b border-zinc-800/40 sticky top-0 bg-[#0a0a0a]">
                      <div className="col-span-5 text-[10px] uppercase tracking-widest text-zinc-600">Market</div>
                      <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-zinc-600">Current</div>
                      <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-zinc-600">Implied</div>
                      <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-zinc-600">Shift</div>
                      <div className="col-span-1 text-right text-[10px] uppercase tracking-widest text-zinc-600">Score</div>
                    </div>

                    {results.map((result, i) => (
                      <ResultRow
                        key={result.market.id}
                        result={result}
                        rank={i + 1}
                        isExpanded={expandedRow === result.market.id}
                        onToggle={() => setExpandedRow(
                          expandedRow === result.market.id ? null : result.market.id
                        )}
                      />
                    ))}
                  </>
                )}
              </div>

              {results.length > 0 && !loading && (
                <div className="border-t border-zinc-800/60 px-6 py-2 flex items-center gap-5 text-[10px] text-zinc-600">
                  <span>{results.length} linked markets</span>
                  <span>Largest edge: <span className={results[0].distortion > 0 ? 'text-emerald-400' : 'text-red-400'}>{formatDistortion(results[0].distortion)}</span></span>
                  <span className="text-zinc-700">Click any row for analysis</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultRow({
  result, rank, isExpanded, onToggle
}: {
  result: ScenarioResult
  rank: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const { market, current_probability, implied_probability, distortion, direction, weight, analysis } = result

  const isUp = direction === 'up'
  const isDown = direction === 'down'
  const distColor = isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-zinc-500'
  const bgBase = isExpanded
    ? (isUp ? 'bg-emerald-500/5' : isDown ? 'bg-red-500/5' : 'bg-zinc-800/20')
    : ''
  const bgHover = isUp ? 'hover:bg-emerald-500/5' : isDown ? 'hover:bg-red-500/5' : 'hover:bg-zinc-800/20'
  const barColor = isUp ? 'bg-emerald-500' : isDown ? 'bg-red-500' : 'bg-zinc-500'
  const edgeScore = Math.abs(distortion * 100).toFixed(1)
  const isHighEdge = Number(edgeScore) > 10

  return (
    <div className={`border-b border-zinc-800/30 transition-colors ${bgBase}`}>
      {/* Main row */}
      <button
        onClick={onToggle}
        className={`w-full grid grid-cols-12 gap-4 px-6 py-3.5 ${bgHover} transition-colors text-left`}
      >
        <div className="col-span-5 flex items-start gap-2 min-w-0">
          <span className="text-[10px] text-zinc-700 font-mono mt-0.5 shrink-0">#{rank}</span>
          <div className="min-w-0">
            <p className="text-xs text-zinc-300 leading-snug line-clamp-2">{market.title}</p>
            <span className="text-[10px] text-zinc-600 uppercase">{market.source}</span>
          </div>
        </div>
        <div className="col-span-2 flex items-center justify-end">
          <span className="text-xs font-mono text-zinc-400">{formatProbability(current_probability)}</span>
        </div>
        <div className="col-span-2 flex items-center justify-end">
          <span className={`text-xs font-mono font-medium ${distColor}`}>{formatProbability(implied_probability)}</span>
        </div>
        <div className="col-span-2 flex flex-col items-end justify-center gap-1">
          <span className={`text-xs font-mono font-semibold ${distColor}`}>
            {isUp ? '↑' : isDown ? '↓' : '→'} {formatDistortion(distortion)}
          </span>
          <div className="w-full h-0.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full opacity-50`}
              style={{ width: `${Math.min(100, Math.abs(distortion) * 300)}%` }} />
          </div>
        </div>
        <div className="col-span-1 flex items-center justify-end">
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            isHighEdge
              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
              : 'text-zinc-600'
          }`}>
            {edgeScore}
          </span>
        </div>
      </button>

      {/* Expanded analysis panel */}
      {isExpanded && (
        <div className={`px-6 pb-4 border-t ${isUp ? 'border-emerald-500/10' : isDown ? 'border-red-500/10' : 'border-zinc-800/30'}`}>
          <div className="pt-4 space-y-4">

            {/* Direction summary */}
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${
              isUp ? 'bg-emerald-500/5 border-emerald-500/15' : isDown ? 'bg-red-500/5 border-red-500/15' : 'bg-zinc-800/20 border-zinc-700/30'
            }`}>
              <div className={`text-lg shrink-0 mt-0.5`}>
                {isUp ? '📈' : isDown ? '📉' : '➡️'}
              </div>
              <div>
                <p className={`text-xs font-semibold mb-0.5 ${distColor}`}>
                  {isUp ? 'This market should be priced HIGHER' : isDown ? 'This market should be priced LOWER' : 'Minimal expected movement'}
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">{analysis}</p>
              </div>
            </div>

            {/* Relationship metadata */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/40">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Relationship</p>
                <p className={`text-xs font-semibold capitalize ${
                  result.relationship_type === 'positive' ? 'text-emerald-400'
                  : result.relationship_type === 'negative' ? 'text-red-400'
                  : 'text-zinc-400'
                }`}>
                  {result.relationship_type}
                </p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/40">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Signal Weight</p>
                <p className="text-xs font-semibold text-zinc-200">
                  {(weight * 100).toFixed(0)}%
                  <span className="text-zinc-600 font-normal ml-1">
                    {weight >= 0.7 ? '· high' : weight >= 0.45 ? '· mid' : '· low'}
                  </span>
                </p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/40">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Edge Score</p>
                <p className={`text-xs font-semibold ${isHighEdge ? 'text-yellow-400' : 'text-zinc-300'}`}>
                  {edgeScore} pp
                  {isHighEdge && <span className="text-yellow-500/70 font-normal ml-1">· notable</span>}
                </p>
              </div>
            </div>

            {/* Probability visual */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">Probability shift</p>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-500 w-10 text-right">{formatProbability(current_probability)}</span>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 bg-zinc-600 rounded-full"
                    style={{ width: `${current_probability * 100}%` }} />
                  <div className={`absolute inset-y-0 left-0 ${barColor} rounded-full opacity-60`}
                    style={{ width: `${implied_probability * 100}%` }} />
                </div>
                <span className={`text-xs font-mono w-10 ${distColor}`}>{formatProbability(implied_probability)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-10" />
                <div className="flex-1 flex justify-between text-[10px] text-zinc-700 px-0.5">
                  <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                </div>
                <span className="w-10" />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
        <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      </div>
      <div>
        <p className="text-zinc-200 text-sm font-semibold mb-1">Model a scenario</p>
        <p className="text-zinc-600 text-xs max-w-xs leading-relaxed">
          Search for a Kalshi market, toggle YES or NO, and see which related markets are mispriced given your assumption.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-left max-w-xs w-full">
        {[
          { label: 'Trump resign → YES', sub: 'See 2028, impeach, Fed' },
          { label: 'Fed abolished → NO', sub: 'See fiscal markets flip' },
          { label: 'China FTA → YES', sub: 'See GDP, manufacturing' },
          { label: 'Taiwan → YES', sub: 'See Level 4, diplomacy' },
        ].map(item => (
          <div key={item.label} className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/40">
            <p className="text-xs text-zinc-300 font-medium">{item.label}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
