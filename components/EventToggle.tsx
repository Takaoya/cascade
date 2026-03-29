'use client'

import { useState } from 'react'
import type { Market } from '@/lib/probability'
import { formatProbability } from '@/lib/probability'

interface EventToggleProps {
  market: Market
  onAssume: (marketId: string, probability: number) => void
  onClear: () => void
  isActive: boolean
}

export function EventToggle({ market, onAssume, onClear, isActive }: EventToggleProps) {
  const [customProb, setCustomProb] = useState<number>(1.0)

  const handleToggle = () => {
    if (isActive) {
      onClear()
    } else {
      onAssume(market.id, customProb)
    }
  }

  return (
    <div
      className={`border rounded-xl p-4 transition-all cursor-pointer ${
        isActive
          ? 'border-indigo-500 bg-indigo-950/40'
          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 leading-snug">{market.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase">
              {market.source}
            </span>
            <span className="text-xs text-zinc-500">
              Market: {formatProbability(market.probability)}
            </span>
          </div>
        </div>

        <button
          onClick={handleToggle}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            isActive
              ? 'bg-indigo-500 text-white hover:bg-indigo-600'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          {isActive ? 'Assumed ✓' : 'Assume this'}
        </button>
      </div>

      {isActive && (
        <div className="mt-3 flex items-center gap-3">
          <label className="text-xs text-zinc-400 shrink-0">Certainty:</label>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(customProb * 100)}
            onChange={(e) => {
              const val = Number(e.target.value) / 100
              setCustomProb(val)
              onAssume(market.id, val)
            }}
            className="flex-1 accent-indigo-500"
          />
          <span className="text-xs font-mono text-indigo-400 w-10 text-right">
            {Math.round(customProb * 100)}%
          </span>
        </div>
      )}
    </div>
  )
}
