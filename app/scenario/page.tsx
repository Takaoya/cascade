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
        body: JSON.stringify({ assumed_market_id: market.id, assumed_probability: prob, resolves_yes: yes }),
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
    setExpandedRow(null)
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

        {/* ── LEFT PANEL ── */}
        <div className="w-72 shrink-0 border-r border-zinc-800/60 flex flex-col">

          {/* Search */}
          <div className="p-4 border-b border-zinc-800/40">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Assume an event</p>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search markets..."
                className="w-full bg-zinc-900 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/70 transition-colors"
              />
              {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />}
            </div>
          </div>

          {/* Search results or hints */}
          {markets.length > 0 ? (
            <div className="flex-1 overflow-y-auto">
              {markets.map(market => (
                <button key={market.id} onClick={() => handleSelect(market)}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-800/30 hover:bg-zinc-800/40 transition-colors group ${assumedMarket?.id === market.id ? 'bg-indigo-500/5 border-l-2 border-l-indigo-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-zinc-300 leading-snug group-hover:text-white transition-colors line-clamp-2 flex-1">{market.title}</p>
                    <span className="text-sm font-mono font-bold text-zinc-200 shrink-0 ml-1">{formatProbability(market.probability)}</span>
                  </div>
                  <div className="mt-2">
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500/50 rounded-full" style={{ width: `${market.probability * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-600 uppercase mt-1 block">{market.source}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 p-4 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Try these</p>
              {[
                { label: 'Trump resign', tag: 'Politics' },
                { label: 'Impeach', tag: 'Politics' },
                { label: 'Fed abolished', tag: 'Economy' },
                { label: 'China trade deal', tag: 'Trade' },
                { label: 'Taiwan', tag: 'Geopolitics' },
                { label: 'Zelenskyy', tag: 'Foreign Policy' },
              ].map(h => (
                <button key={h.label} onClick={() => setQuery(h.label)}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-left hover:bg-zinc-800/40 transition-colors group">
                  <span className="text-xs text-zinc-400 group-hover:text-white transition-colors">{h.label}</span>
                  <span className="text-[10px] text-zinc-700 group-hover:text-zinc-500">{h.tag}</span>
                </button>
              ))}
            </div>
          )}

          {/* Controls */}
          {assumedMarket && (
            <div className="border-t border-zinc-800/60 p-4 space-y-4 bg-zinc-900/20">
              {/* YES / NO */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">If this resolves...</p>
                <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-zinc-700/50">
                  <button onClick={() => handleResolutionToggle(true)}
                    className={`py-2.5 text-xs font-bold tracking-wide transition-all ${resolvesYes ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    YES ✓
                  </button>
                  <button onClick={() => handleResolutionToggle(false)}
                    className={`py-2.5 text-xs font-bold tracking-wide border-l border-zinc-700/50 transition-all ${!resolvesYes ? 'bg-red-500/20 text-red-300' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    NO ✗
                  </button>
                </div>
              </div>

              {/* Certainty */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500">Your certainty</p>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{Math.round(assumedProbability * 100)}%</span>
                </div>
                <input type="range" min="1" max="100" value={Math.round(assumedProbability * 100)}
                  onChange={e => handleCertaintyChange(Number(e.target.value) / 100)}
                  className="w-full accent-indigo-500" />
                <div className="flex justify-between text-[10px] text-zinc-700 mt-0.5">
                  <span>Speculative</span><span>Certain</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {!assumedMarket ? (
            <EmptyState onSearch={setQuery} />
          ) : (
            <>
              {/* Scenario header */}
              <div id="scenario-output" className="border-b border-zinc-800/60 px-6 py-4 bg-zinc-900/10">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500">Scenario</span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${resolvesYes ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                        {resolvesYes ? '✓ YES' : '✗ NO'}
                      </span>
                      <span className="text-[10px] text-zinc-600">at {Math.round(assumedProbability * 100)}% certainty</span>
                    </div>
                    <p className="text-base font-semibold text-white leading-snug">{assumedMarket.title}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Kalshi market price: <span className="font-mono text-zinc-300 font-semibold">{formatProbability(assumedMarket.probability)}</span>
                    </p>
                  </div>

                  {/* Live stats */}
                  {results.length > 0 && !loading && (
                    <div className="flex items-center gap-3 shrink-0">
                      <StatPill label="Signals" value={String(results.length)} />
                      <StatPill label="Buy YES" value={String(upCount)} color="emerald" />
                      <StatPill label="Buy NO" value={String(downCount)} color="red" />
                      <StatPill label="Max Edge" value={`${maxEdge.toFixed(1)}pp`} color="yellow" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    <ShareButton targetId="scenario-output" tweetText={tweetText} />
                    <button onClick={() => { setAssumedMarket(null); setResults([]); setQuery(''); setExpandedRow(null) }}
                      className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-200 border border-zinc-700/50 rounded-lg transition-colors">
                      ✕ Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <div className="w-5 h-5 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-xs text-zinc-600">Computing cascade...</p>
                  </div>
                ) : results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-2">
                    <p className="text-zinc-500 text-sm">No related markets mapped.</p>
                    <p className="text-zinc-700 text-xs">Try a different market.</p>
                  </div>
                ) : (
                  <>
                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-2 px-6 py-2 border-b border-zinc-800/40 sticky top-0 bg-[#0a0a0a] z-10">
                      <div className="col-span-4 text-[10px] uppercase tracking-widest text-zinc-600">Market</div>
                      <div className="col-span-2 text-center text-[10px] uppercase tracking-widest text-zinc-600">Trade</div>
                      <div className="col-span-1 text-right text-[10px] uppercase tracking-widest text-zinc-600">Now</div>
                      <div className="col-span-1 text-right text-[10px] uppercase tracking-widest text-zinc-600">Fair</div>
                      <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-zinc-600">Edge</div>
                      <div className="col-span-1 text-center text-[10px] uppercase tracking-widest text-zinc-600">Signal</div>
                      <div className="col-span-1 text-right text-[10px] uppercase tracking-widest text-zinc-600">Score</div>
                    </div>
                    {results.map((result, i) => (
                      <ResultRow key={result.market.id} result={result} rank={i + 1}
                        isExpanded={expandedRow === result.market.id}
                        onToggle={() => setExpandedRow(expandedRow === result.market.id ? null : result.market.id)}
                      />
                    ))}
                  </>
                )}
              </div>

              {/* Footer */}
              {results.length > 0 && !loading && (
                <div className="border-t border-zinc-800/60 px-6 py-2 flex items-center gap-5 text-[10px] text-zinc-600">
                  <span>{results.length} markets analyzed</span>
                  <span>Avg edge: <span className="text-zinc-400">{avgEdge.toFixed(1)}pp</span></span>
                  <span>Best signal: <span className={results[0].distortion > 0 ? 'text-emerald-400' : 'text-red-400'}>{formatDistortion(results[0].distortion)} on {results[0].market.title.slice(0, 35)}...</span></span>
                  <span className="ml-auto text-zinc-700">↓ Click any row to expand analysis</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    default: 'text-zinc-300 bg-zinc-800/50 border-zinc-700/30',
  }
  const cls = colors[color ?? 'default']
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg border ${cls}`}>
      <span className="text-sm font-bold font-mono leading-none">{value}</span>
      <span className="text-[9px] uppercase tracking-widest mt-0.5 opacity-70">{label}</span>
    </div>
  )
}

// ── Signal strength dots ──────────────────────────────────
function SignalDots({ weight }: { weight: number }) {
  const filled = weight >= 0.7 ? 3 : weight >= 0.45 ? 2 : 1
  return (
    <div className="flex items-center gap-1 justify-center">
      {[1, 2, 3].map(i => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= filled ? 'bg-indigo-400' : 'bg-zinc-700'}`} />
      ))}
    </div>
  )
}

// ── Result row ────────────────────────────────────────────
function ResultRow({ result, rank, isExpanded, onToggle }: {
  result: ScenarioResult; rank: number; isExpanded: boolean; onToggle: () => void
}) {
  const { market, current_probability, implied_probability, distortion, direction, weight, analysis, relationship_type } = result

  const isUp = direction === 'up'
  const isDown = direction === 'down'
  const distColor = isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-zinc-500'
  const rowBg = isExpanded
    ? (isUp ? 'bg-emerald-500/5' : isDown ? 'bg-red-500/5' : 'bg-zinc-800/20')
    : (isUp ? 'hover:bg-emerald-500/4' : isDown ? 'hover:bg-red-500/4' : 'hover:bg-zinc-800/20')
  const edgeScore = Math.abs(distortion * 100)
  const isHighEdge = edgeScore > 10

  // Trade recommendation
  const tradeLabel = isUp ? 'BUY YES' : isDown ? 'BUY NO' : 'NEUTRAL'
  const tradeBg = isUp
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : isDown
    ? 'bg-red-500/15 text-red-300 border-red-500/30'
    : 'bg-zinc-800/40 text-zinc-500 border-zinc-700/30'

  return (
    <div className={`border-b border-zinc-800/30 transition-colors ${rowBg}`}>
      <button onClick={onToggle} className="w-full grid grid-cols-12 gap-2 px-6 py-3.5 text-left">

        {/* Market name */}
        <div className="col-span-4 flex items-start gap-2 min-w-0">
          <span className="text-[10px] text-zinc-700 font-mono mt-0.5 shrink-0 w-4">{rank}</span>
          <div className="min-w-0">
            <p className="text-xs text-zinc-300 leading-snug line-clamp-2">{market.title}</p>
          </div>
        </div>

        {/* Trade pill */}
        <div className="col-span-2 flex items-center justify-center">
          <span className={`text-[10px] font-bold px-2 py-1 rounded border tracking-wide ${tradeBg}`}>
            {tradeLabel}
          </span>
        </div>

        {/* Current price */}
        <div className="col-span-1 flex items-center justify-end">
          <span className="text-xs font-mono text-zinc-400">{formatProbability(current_probability)}</span>
        </div>

        {/* Fair / implied price */}
        <div className="col-span-1 flex items-center justify-end">
          <span className={`text-xs font-mono font-semibold ${distColor}`}>{formatProbability(implied_probability)}</span>
        </div>

        {/* Edge shift */}
        <div className="col-span-2 flex flex-col items-end justify-center gap-1">
          <span className={`text-xs font-mono font-bold ${distColor}`}>
            {isUp ? '↑' : isDown ? '↓' : '→'} {formatDistortion(distortion)}
          </span>
          <div className="w-full h-0.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${isUp ? 'bg-emerald-500' : isDown ? 'bg-red-500' : 'bg-zinc-500'} opacity-60`}
              style={{ width: `${Math.min(100, edgeScore * 3)}%` }} />
          </div>
        </div>

        {/* Signal dots */}
        <div className="col-span-1 flex items-center justify-center">
          <SignalDots weight={weight} />
        </div>

        {/* Score badge */}
        <div className="col-span-1 flex items-center justify-end">
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
            isHighEdge ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'text-zinc-600'
          }`}>
            {edgeScore.toFixed(1)}
          </span>
        </div>
      </button>

      {/* ── Expanded analysis ── */}
      {isExpanded && (
        <div className={`px-6 pb-5 pt-1 border-t ${isUp ? 'border-emerald-500/10' : isDown ? 'border-red-500/10' : 'border-zinc-800/30'}`}>
          <div className="ml-6 space-y-4">

            {/* Trade thesis — most important for a trader */}
            <div className={`rounded-xl p-4 border ${isUp ? 'bg-emerald-500/5 border-emerald-500/20' : isDown ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-800/20 border-zinc-700/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${tradeBg}`}>{tradeLabel}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Trade thesis</span>
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed">
                {isUp
                  ? `Current market price is ${formatProbability(current_probability)}. Given this scenario, fair value is ~${formatProbability(implied_probability)} — ${formatDistortion(distortion)} higher. The market appears underpriced. Consider buying YES.`
                  : isDown
                  ? `Current market price is ${formatProbability(current_probability)}. Given this scenario, fair value is ~${formatProbability(implied_probability)} — ${formatDistortion(Math.abs(distortion))} lower. The market appears overpriced. Consider buying NO.`
                  : `This market is unlikely to move significantly given this scenario.`
                }
              </p>
            </div>

            {/* Why it moves */}
            <div className="rounded-xl p-4 bg-zinc-900/50 border border-zinc-800/40">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Why it moves</p>
              <p className="text-xs text-zinc-300 leading-relaxed">{analysis}</p>
            </div>

            {/* Metadata row */}
            <div className="grid grid-cols-4 gap-3">
              <MetaCard label="Relationship" value={relationship_type}
                color={relationship_type === 'positive' ? 'emerald' : relationship_type === 'negative' ? 'red' : 'zinc'} />
              <MetaCard label="Signal Weight"
                value={`${(weight * 100).toFixed(0)}%`}
                sub={weight >= 0.7 ? 'High conviction' : weight >= 0.45 ? 'Moderate' : 'Low conviction'} />
              <MetaCard label="Edge"
                value={`${edgeScore.toFixed(1)}pp`}
                sub={isHighEdge ? 'Notable opportunity' : 'Modest signal'}
                color={isHighEdge ? 'yellow' : 'zinc'} />
              <MetaCard label="Direction" value={isUp ? 'Underpriced' : isDown ? 'Overpriced' : 'Neutral'}
                color={isUp ? 'emerald' : isDown ? 'red' : 'zinc'} />
            </div>

            {/* Probability bar visual */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">Probability shift</p>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-500 w-12 text-right">{formatProbability(current_probability)}</span>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-zinc-600 rounded-full transition-all"
                    style={{ width: `${current_probability * 100}%` }} />
                  <div className={`absolute inset-y-0 left-0 rounded-full opacity-70 transition-all ${isUp ? 'bg-emerald-500' : isDown ? 'bg-red-500' : 'bg-zinc-500'}`}
                    style={{ width: `${implied_probability * 100}%` }} />
                </div>
                <span className={`text-xs font-mono font-bold w-12 ${distColor}`}>{formatProbability(implied_probability)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-12" />
                <div className="flex-1 flex justify-between text-[10px] text-zinc-700">
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
    emerald: 'text-emerald-400', red: 'text-red-400', yellow: 'text-yellow-400', zinc: 'text-zinc-200'
  }
  return (
    <div className="bg-zinc-900/60 rounded-lg p-3 border border-zinc-800/40">
      <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">{label}</p>
      <p className={`text-xs font-semibold capitalize ${colors[color]}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function EmptyState({ onSearch }: { onSearch: (q: string) => void }) {
  const examples = [
    { q: 'Trump resign', scenario: 'resolves YES', impact: '↓ GOP 2028, ↑ Impeach odds' },
    { q: 'Fed abolished', scenario: 'resolves NO', impact: '→ Debt, fiscal markets' },
    { q: 'China trade deal', scenario: 'resolves YES', impact: '↓ GDP gap, ↑ Manufacturing' },
    { q: 'Taiwan', scenario: 'resolves YES', impact: '↑ Level 4 advisory' },
  ]
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-12">
      <div className="text-center">
        <p className="text-zinc-200 text-base font-semibold mb-1">Model a conditional scenario</p>
        <p className="text-zinc-600 text-xs max-w-sm leading-relaxed">
          Search for any Kalshi market on the left. Toggle YES or NO. See which related markets are mispriced — and exactly what to trade.
        </p>
      </div>

      <div className="w-full max-w-xl">
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Example scenarios</p>
        <div className="grid grid-cols-2 gap-2">
          {examples.map(ex => (
            <button key={ex.q} onClick={() => onSearch(ex.q)}
              className="text-left p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/40 hover:border-zinc-700 hover:bg-zinc-800/30 transition-all group">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-zinc-200 group-hover:text-white">{ex.q}</p>
                <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">{ex.scenario}</span>
              </div>
              <p className="text-[10px] text-zinc-500">{ex.impact}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 text-[10px] text-zinc-700">
        <span>🟢 Green = underpriced → BUY YES</span>
        <span>🔴 Red = overpriced → BUY NO</span>
        <span>🟡 Score = edge in pp</span>
      </div>
    </div>
  )
}
