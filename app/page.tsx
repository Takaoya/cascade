import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col">

      {/* Nav */}
      <header className="border-b border-zinc-800/60 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-widest text-white uppercase">Cascade</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">Beta</span>
        </div>
        <Link
          href="/scenario"
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          Open App →
        </Link>
      </header>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full space-y-10">

          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-indigo-400">Conditional Probability Engine</p>
            <h1 className="text-4xl font-bold tracking-tight leading-tight">
              See how one outcome<br />reshapes the entire market.
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed max-w-lg">
              Prediction markets price events independently. Cascade models the conditional
              relationships — showing you exactly which markets are mispriced when you assume
              an event happens.
            </p>
          </div>

          <Link
            href="/scenario"
            className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all"
          >
            Open Scenario Tree
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Example row */}
          <div className="border border-zinc-800/60 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800/60 bg-zinc-900/30">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Example scenario</p>
              <p className="text-sm font-semibold text-white mt-0.5">If Trump resigns...</p>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {[
                { market: 'GOP wins 2028 presidency', from: '52%', to: '38%', delta: '-14pp', dir: 'down' },
                { market: 'Trump impeached', from: '11%', to: '22%', delta: '+11pp', dir: 'up' },
                { market: 'Trump removed from office', from: '8%', to: '18%', delta: '+10pp', dir: 'up' },
                { market: 'Fed abolished before 2029', from: '6%', to: '2%', delta: '-4pp', dir: 'down' },
              ].map(row => (
                <div key={row.market} className="grid grid-cols-12 gap-4 px-5 py-3 text-xs">
                  <div className="col-span-6 text-zinc-400">{row.market}</div>
                  <div className="col-span-2 text-right font-mono text-zinc-500">{row.from}</div>
                  <div className={`col-span-2 text-right font-mono ${row.dir === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>{row.to}</div>
                  <div className={`col-span-2 text-right font-mono font-semibold ${row.dir === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>{row.delta}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
