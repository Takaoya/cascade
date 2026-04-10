'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

// ── News ticker strip ─────────────────────────────────────────────────────────
interface Headline { title: string; url: string; source: string; publishedAt: string }

function NewsTicker() {
  const [headlines, setHeadlines] = useState<Headline[]>([])
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/news')
      .then(r => r.json())
      .then(d => setHeadlines(d.headlines ?? []))
      .catch(() => {})
  }, [])

  if (headlines.length === 0) return null

  // Duplicate for seamless loop
  const items = [...headlines, ...headlines]

  return (
    <div className="w-full flex items-center bg-white border-y border-green-100">
      {/* Pinned label */}
      <div className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 border-r border-green-100 bg-green-50 z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
        <span className="text-[10px] uppercase tracking-widest font-black text-green-700 whitespace-nowrap">Trending News</span>
      </div>

      {/* Scrolling track */}
      <div className="flex-1 overflow-hidden py-2.5 pl-4">
        <div
          ref={trackRef}
          className="flex gap-8 w-max animate-[ticker_40s_linear_infinite]"
          style={{ willChange: 'transform' }}
        >
          {items.map((h, i) => (
            <a
              key={i}
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 shrink-0 group"
            >
              <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200 shrink-0">
                {h.source}
              </span>
              <span className="text-xs text-slate-600 group-hover:text-green-700 transition-colors font-medium max-w-xs truncate">
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

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const { ref, visible } = useReveal(0.3)
  useEffect(() => {
    if (!visible) return
    const duration = 1200
    const steps = 40
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current = Math.min(current + increment, target)
      setCount(Math.floor(current))
      if (current >= target) clearInterval(timer)
    }, duration / steps)
    return () => clearInterval(timer)
  }, [visible, target])
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// ── Animated scenario rows ────────────────────────────────────────────────────
const SCENARIO_ROWS = [
  { market: 'Trump impeached before end of term', from: '11%', to: '22%', delta: '+11pp', dir: 'up' },
  { market: 'Trump removed from office', from: '8%', to: '18%', delta: '+10pp', dir: 'up' },
  { market: '25th Amendment invoked', from: '5%', to: '13%', delta: '+8pp', dir: 'up' },
  { market: 'Fed abolished before 2029', from: '6%', to: '2%', delta: '-4pp', dir: 'down' },
  { market: 'Martial law declared', from: '9%', to: '3%', delta: '-6pp', dir: 'down' },
]

function ScenarioDemo() {
  const { ref, visible } = useReveal(0.1)
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="bg-white rounded-2xl shadow-xl shadow-green-100/60 border border-green-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-green-100 font-semibold">Live example</p>
            <p className="text-sm font-bold text-white mt-0.5">If Trump resigns → YES</p>
          </div>
          <div className="flex gap-2">
            <span className="text-[9px] px-2.5 py-1 rounded-full bg-white/20 text-white font-bold">3 Buy YES</span>
            <span className="text-[9px] px-2.5 py-1 rounded-full bg-white/20 text-white font-bold">2 Buy NO</span>
          </div>
        </div>
        {/* Column headers */}
        <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-slate-50 border-b border-slate-100">
          <div className="col-span-6 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Market</div>
          <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Now</div>
          <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Fair</div>
          <div className="col-span-2 text-right text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Edge</div>
        </div>
        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {SCENARIO_ROWS.map((row, i) => (
            <div key={row.market}
              className={`grid grid-cols-12 gap-2 px-5 py-3 text-xs transition-all duration-500 ${
                row.dir === 'up' ? 'hover:bg-emerald-50' : 'hover:bg-red-50'
              } ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
              style={{ transitionDelay: `${i * 80 + 200}ms` }}>
              <div className="col-span-6 text-slate-600 font-medium">{row.market}</div>
              <div className="col-span-2 text-right font-mono text-slate-400">{row.from}</div>
              <div className={`col-span-2 text-right font-mono font-bold ${row.dir === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>{row.to}</div>
              <div className={`col-span-2 text-right font-mono font-black ${row.dir === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>{row.delta}</div>
            </div>
          ))}
        </div>
        {/* Footer CTA */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">5 markets analyzed · Avg edge 7.8pp</p>
          <Link href="/scenario" className="text-[11px] font-bold text-green-600 hover:text-green-700 transition-colors">
            Try it live →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: number }) {
  const { ref, visible } = useReveal(0.1)
  return (
    <div ref={ref}
      className={`bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all duration-500 cursor-default ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${delay}ms` }}>
      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl mb-4">{icon}</div>
      <p className="text-sm font-bold text-slate-800 mb-2">{title}</p>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </div>
  )
}

// ── Step row ──────────────────────────────────────────────────────────────────
function StepRow({ num, title, desc, delay }: { num: string; title: string; desc: string; delay: number }) {
  const { ref, visible } = useReveal(0.1)
  return (
    <div ref={ref}
      className={`flex items-start gap-5 transition-all duration-600 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'}`}
      style={{ transitionDelay: `${delay}ms` }}>
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md shadow-green-200">
        {num}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800 mb-1">{title}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

// ── Main landing ──────────────────────────────────────────────────────────────
export default function Landing({ markets, relationships }: { markets: number; relationships: number }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className="min-h-screen bg-[#f7fdf7] text-slate-800 font-sans">

      {/* Nav */}
      <header className={`sticky top-0 z-50 px-6 py-3 flex items-center justify-between transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm shadow-slate-100' : 'bg-transparent'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-black tracking-[0.2em] uppercase bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Cascade
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-green-100 text-green-700 border border-green-200 uppercase tracking-widest font-bold">Beta</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/top" className="text-xs text-slate-500 hover:text-green-600 transition-colors font-medium">Market Movers</Link>
          <Link href="/scenario"
            className="text-xs font-bold px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm shadow-green-200">
            Try Cascade →
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="px-6 pt-24 pb-20 flex flex-col items-center text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.05] text-slate-900">
            If one market moves,<br />which others are wrong?
          </h1>

          <p className="text-slate-500 text-lg leading-relaxed max-w-lg mx-auto">
            Kalshi markets price events in isolation — but events are correlated.
            Pick any market, set it to YES or NO, and Cascade instantly shows you which related markets are now mispriced and by how much.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/scenario"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold transition-colors">
              Analyze a market →
            </Link>
            <Link href="/top"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
              See what&apos;s trending
            </Link>
          </div>

          {/* Stats */}
          {markets > 0 && (
            <div className="flex items-center justify-center gap-8 pt-4 border-t border-slate-100">
              <div className="text-center">
                <p className="text-2xl font-black text-slate-900"><Counter target={markets} /></p>
                <p className="text-[11px] text-slate-400 mt-0.5">markets tracked</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-slate-900"><Counter target={relationships} /></p>
                <p className="text-[11px] text-slate-400 mt-0.5">correlations mapped</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-slate-900">Kalshi</p>
                <p className="text-[11px] text-slate-400 mt-0.5">live data</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── News ticker ── */}
      <NewsTicker />

      {/* ── Live demo ── */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <p className="text-[11px] uppercase tracking-widest text-green-600 font-bold">See it in action</p>
            <h2 className="text-3xl font-black text-slate-900">One search. Instant edge.</h2>
            <p className="text-slate-500 text-sm max-w-lg mx-auto">Search any Kalshi market, set it to YES or NO, and Cascade instantly surfaces every related market that&apos;s now mispriced.</p>
          </div>
          <ScenarioDemo />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-20 bg-[#f7fdf7]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-[11px] uppercase tracking-widest text-green-600 font-bold">Why Cascade</p>
            <h2 className="text-3xl font-black text-slate-900">Built for serious Kalshi traders</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard delay={0} icon="🔗"
              title="Conditional probability engine"
              desc="Models how one market outcome ripples across related markets — something no other tool does." />
            <FeatureCard delay={100} icon="⚡"
              title="Instant analysis"
              desc="Results in under a second. No waiting, no manual research. Just pick a market and see the cascade." />
            <FeatureCard delay={200} icon="🎯"
              title="Edge in basis points"
              desc="Every signal shows the exact gap between current price and implied fair value — ranked by opportunity size." />
            <FeatureCard delay={300} icon="📊"
              title="13,000+ markets"
              desc="Every open Kalshi market tracked in real-time. Politics, economics, finance, global events." />
            <FeatureCard delay={400} icon="📱"
              title="Share your edge"
              desc="One-click screenshot of any scenario. Post to X/Twitter and show the market what it&apos;s missing." />
            <FeatureCard delay={500} icon="🔄"
              title="Daily price sync"
              desc="Market prices update automatically every day so your signals are always based on current data." />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-10">
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-widest text-green-600 font-bold">How it works</p>
                <h2 className="text-3xl font-black text-slate-900">Three steps to find the edge</h2>
              </div>
              <div className="space-y-8">
                <StepRow delay={0} num="1" title="Pick any market"
                  desc="Search any Kalshi market by name or paste a URL directly. Cascade finds it instantly." />
                <StepRow delay={150} num="2" title="Set YES or NO"
                  desc="Assume the market resolves YES or NO. Adjust certainty with the slider for partial scenarios." />
                <StepRow delay={300} num="3" title="See what&apos;s mispriced"
                  desc="Cascade shows every related market ranked by edge — biggest mispricing opportunity at the top." />
              </div>
              <Link href="/scenario"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md shadow-green-200 hover:-translate-y-0.5">
                Try it now →
              </Link>
            </div>

            {/* Right side — scenario preview card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="flex-1 bg-white rounded-md px-3 py-1.5 text-[11px] text-slate-400 font-mono border border-slate-200">
                  cascade-chi-six.vercel.app/scenario
                </div>
              </div>
              {[
                { label: 'Assumed market', value: 'Trump resigns → YES', color: 'text-emerald-600' },
                { label: 'Signals found', value: '9 markets', color: 'text-green-600' },
                { label: 'Max edge', value: '+70.7pp', color: 'text-amber-600' },
                { label: 'Buy YES', value: '3 markets underpriced', color: 'text-emerald-600' },
                { label: 'Buy NO', value: '5 markets overpriced', color: 'text-red-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm">
                  <span className="text-xs text-slate-500 font-medium">{item.label}</span>
                  <span className={`text-xs font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="px-6 py-20 bg-gradient-to-br from-green-700 via-green-600 to-emerald-700 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-white/5 rounded-full blur-[80px]" />
          <div className="absolute bottom-0 right-1/4 w-[300px] h-[200px] bg-white/5 rounded-full blur-[60px]" />
        </div>
        <div className="max-w-2xl mx-auto text-center space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            The market prices events independently.<br />
            <span className="text-green-200">You don&apos;t have to.</span>
          </h2>
          <p className="text-green-100 text-sm leading-relaxed">
            Every time a major market shifts, related markets lag behind. Cascade finds that lag — instantly.
          </p>
          <Link href="/scenario"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-green-700 rounded-xl text-sm font-black hover:bg-green-50 transition-all shadow-lg shadow-green-900/20 hover:-translate-y-0.5">
            Open Scenario Builder
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black tracking-[0.2em] uppercase bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Cascade</span>
          <span className="text-[10px] text-slate-400">Beta</span>
        </div>
        <p className="text-[11px] text-slate-400">Prediction market data via Kalshi</p>
      </footer>

    </div>
  )
}
