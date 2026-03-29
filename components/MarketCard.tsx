'use client'

import type { ScenarioResult } from '@/lib/probability'
import { formatProbability, formatDistortion } from '@/lib/probability'

interface MarketCardProps {
  result: ScenarioResult
  rank: number
}

export function MarketCard({ result, rank }: MarketCardProps) {
  const { market, current_probability, implied_probability, distortion, direction } = result

  const directionColor =
    direction === 'up'
      ? 'text-emerald-400'
      : direction === 'down'
      ? 'text-red-400'
      : 'text-zinc-400'

  const directionArrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'

  const barWidth = Math.round(implied_probability * 100)
  const currentBarWidth = Math.round(current_probability * 100)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-mono">#{rank}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase tracking-wide">
            {market.source}
          </span>
        </div>
        <span className={`text-lg font-bold font-mono ${directionColor}`}>
          {directionArrow} {formatDistortion(distortion)}
        </span>
      </div>

      <p className="text-sm text-zinc-100 leading-snug">{market.title}</p>

      {/* Probability bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Current: {formatProbability(current_probability)}</span>
          <span className={directionColor}>Implied: {formatProbability(implied_probability)}</span>
        </div>
        <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
          {/* current bar */}
          <div
            className="absolute inset-y-0 left-0 bg-zinc-600 rounded-full"
            style={{ width: `${currentBarWidth}%` }}
          />
          {/* implied bar overlay */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full opacity-60 ${
              direction === 'up' ? 'bg-emerald-500' : direction === 'down' ? 'bg-red-500' : 'bg-zinc-500'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </div>
  )
}
