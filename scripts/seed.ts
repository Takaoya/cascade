/**
 * Cascade seed script
 *
 * Phase 1 — Market sync:
 *   Discovers ALL open events on Kalshi across Politics, Economics, Elections,
 *   and Financial categories. Fetches every market under those events and
 *   upserts them into Supabase. No manual curation required.
 *
 * Phase 2 — Relationship seeding:
 *   Seeds curated market relationships with notes (used for cascade analysis).
 *   These are hand-written and don't change with re-runs.
 *
 * Usage:
 *   npm run seed          — full sync + relationships
 *   npm run seed:markets  — markets only (faster, no relationship changes)
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'
const KALSHI_KEY = process.env.KALSHI_API_KEY!
const HEADERS = { Authorization: `Bearer ${KALSHI_KEY}`, 'Content-Type': 'application/json' }

// Categories to sync — covers all meaningful prediction market content on Kalshi
const CATEGORIES = ['Politics', 'Economics', 'Elections', 'Financial', 'Climate', 'Technology']

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Step 1: Discover all event tickers for our categories ─────────────────────

async function fetchEventTickers(): Promise<string[]> {
  const tickers: string[] = []

  for (const category of CATEGORIES) {
    let cursor: string | null = null
    let page = 0

    while (true) {
      await sleep(150)
      const params = new URLSearchParams({ status: 'open', limit: '200', category })
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`${KALSHI_BASE}/events?${params}`, { headers: HEADERS })
      if (!res.ok) {
        console.warn(`  ⚠ Events ${category}: HTTP ${res.status}`)
        break
      }

      const data = await res.json()
      const events: any[] = data.events ?? []
      events.forEach(e => tickers.push(e.event_ticker ?? e.ticker))

      cursor = data.cursor ?? null
      page++
      if (!cursor || events.length === 0) break
      if (page > 10) break // safety cap: 200 × 10 = 2000 events per category
    }

    console.log(`  ✓ ${category}: discovered ${tickers.length} events so far`)
  }

  // Deduplicate
  return [...new Set(tickers)]
}

// ── Step 2: Fetch markets for each event ticker ───────────────────────────────

async function fetchMarketsForEvent(eventTicker: string): Promise<any[]> {
  await sleep(150)
  const res = await fetch(
    `${KALSHI_BASE}/markets?event_ticker=${eventTicker}&status=open&limit=20`,
    { headers: HEADERS }
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.markets ?? []
}

function getPrice(market: any): number {
  const bid = parseFloat(market.yes_bid_dollars) || 0
  const ask = parseFloat(market.yes_ask_dollars) || 0
  if (bid > 0 && ask > 0) return (bid + ask) / 2
  return parseFloat(market.last_price_dollars) || 0
}

// ── Phase 1: Full market sync ─────────────────────────────────────────────────

export async function syncMarkets() {
  console.log('\n🔍 Discovering events from Kalshi...\n')
  const eventTickers = await fetchEventTickers()
  console.log(`\n📋 Found ${eventTickers.length} unique events across ${CATEGORIES.join(', ')}\n`)

  console.log('📥 Fetching markets for each event...\n')
  const allMarkets: any[] = []
  let fetched = 0

  for (const eventTicker of eventTickers) {
    const markets = await fetchMarketsForEvent(eventTicker)
    if (markets.length > 0) {
      allMarkets.push(...markets)
      fetched++
      process.stdout.write(`\r  Fetched ${fetched}/${eventTickers.length} events — ${allMarkets.length} markets`)
    }
  }

  console.log(`\n\n💾 Upserting ${allMarkets.length} markets into Supabase...`)

  // Batch upsert in chunks of 100
  const BATCH = 100
  let upserted = 0

  for (let i = 0; i < allMarkets.length; i += BATCH) {
    const batch = allMarkets.slice(i, i + BATCH)
    const rows = batch.map((m: any) => ({
      source: 'kalshi',
      external_id: m.ticker,
      title: m.title,
      probability: Math.min(1, Math.max(0, getPrice(m))),
      category: m.event_ticker,
      last_updated: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('markets')
      .upsert(rows, { onConflict: 'source,external_id' })

    if (error) {
      console.error(`\n❌ Batch ${i / BATCH + 1} error:`, error.message)
    } else {
      upserted += rows.length
    }
  }

  console.log(`✅ Synced ${upserted} markets successfully!\n`)
  return upserted
}

// ── Phase 2: Relationship seeding (unchanged) ─────────────────────────────────

async function seedRelationships() {
  console.log('🔗 Seeding market relationships...\n')

  const { data: markets, error } = await supabase
    .from('markets')
    .select('id, external_id, title, category')

  if (error || !markets) {
    console.error('❌ Could not fetch markets:', error?.message)
    return
  }

  const getEventMarket = (eventTicker: string) =>
    markets.find(m => m.category === eventTicker)

  type RelDef = [string, string, 'positive' | 'negative' | 'neutral', number, string]

  const RELATIONSHIPS: RelDef[] = [
    // Trump destabilization cluster
    ['KXTRUMPRESIGN',   'KXIMPEACH-29',     'positive', 0.80, 'Resignation signals political collapse → impeachment odds rise together'],
    ['KXTRUMPRESIGN',   'KXTRUMPREMOVE',    'positive', 0.90, 'Resign and removal are near-synonymous outcomes'],
    ['KXIMPEACH-29',    'KXTRUMPREMOVE',    'positive', 0.65, 'Impeachment is prerequisite for removal'],
    ['KXTRUMPRESIGN',   'KXINSURRECTION-29','negative', 0.50, 'Resignation makes invoking Insurrection Act less likely'],
    ['KXTRUMPRESIGN',   'KXAMEND25-29',     'positive', 0.60, 'Cabinet invoking 25th is a path to effective removal'],
    ['KXTRUMPRESIGN',   'KXMARTIAL-29JAN20','negative', 0.70, 'Resignation prevents martial law escalation'],
    ['KXTRUMPRESIGN',   'KXHABEAS-29',      'negative', 0.55, 'Resignation reduces authoritarian escalation odds'],
    ['KXTRUMPRESIGN',   'KXPRESPARTY-2028', 'negative', 0.60, 'Resignation hurts Republican 2028 prospects'],
    ['KXTRUMPRESIGN',   'KXFEDEND-29',      'negative', 0.70, 'Resignation ends Trump Fed policy ambitions'],
    ['KXTRUMPRESIGN',   'KXDOED-29',        'negative', 0.60, 'Resignation halts Dept of Education abolition'],
    // Trump power escalation cluster
    ['KXINSURRECTION-29','KXMARTIAL-29JAN20','positive', 0.75, 'Insurrection Act is a step toward martial law'],
    ['KXINSURRECTION-29','KXHABEAS-29',      'positive', 0.65, 'Emergency powers cluster together'],
    ['KXMARTIAL-29JAN20','KXIMPEACH-29',     'positive', 0.70, 'Martial law would trigger impeachment response'],
    ['KXFEDEND-29',      'KXBALANCE-29',     'positive', 0.45, 'Ending Fed signals extreme fiscal control ambitions'],
    ['KXFEDEND-29',      'KXPRESPARTY-2028', 'negative', 0.40, 'Ending Fed would cause market chaos hurting GOP 2028'],
    // Trade / economy cluster
    ['KXFTAPRC-29',     'CHINAUSGDP',        'negative', 0.55, 'New China FTA reduces chance China overtakes US GDP'],
    ['KXFTAPRC-29',     'KXGDPSHAREMANU-29', 'positive', 0.50, 'China FTA could include manufacturing deal'],
    ['KXFTA-29',        'KXGDPUSMAX-28',     'positive', 0.55, 'New trade deals support economic growth'],
    ['KXBALANCE-29',    'KXDEBTGROWTH-28DEC31','negative',0.60, 'Balancing budget limits debt growth'],
    ['KXGOVTCUTS-28',   'KXBALANCE-29',      'positive', 0.65, 'Spending cuts are mechanism to balance budget'],
    ['KXGOVTCUTS-28',   'KXU3MAX-30',        'positive', 0.45, 'Major spending cuts risk increasing unemployment'],
    ['KXGDPUSMAX-28',   'KXU3MAX-30',        'negative', 0.60, 'Strong GDP growth keeps unemployment low'],
    ['KXGDPSHAREMANU-29','KXGDPUSMAX-28',    'positive', 0.50, 'Manufacturing revival supports overall GDP'],
    // Foreign policy cluster
    ['KXZELENSKYPUTIN-29','KXABRAHAMSA-29',  'positive', 0.30, 'Active diplomacy on one front often flows to others'],
    ['KXZELENSKYPUTIN-29','KXABRAHAMSY-29',  'positive', 0.30, 'Same diplomatic momentum'],
    ['KXRECOGROC-29',   'KXTAIWANLVL4',      'positive', 0.70, 'Recognizing Taiwan triggers security escalation'],
    ['KXCANAL-29',      'KXSTATE51-29',      'positive', 0.40, 'Both are territorial expansion moves'],
    ['KXCANTERRITORY-29','KXSTATE51-29',     'positive', 0.65, 'Canada territory annexation is path to 51st state'],
    ['KXGREENTERRITORY-29','KXSTATE51-29',   'positive', 0.55, 'Greenland territory is path to new state'],
    ['KXUSAKIM-29',     'KXZELENSKYPUTIN-29','positive', 0.35, 'Trump diplomatic engagement correlates across theaters'],
    // 2028 election cluster
    ['KXTRUMPREMOVE',   'KXPRESPARTY-2028',  'negative', 0.65, 'Removal damages Republican 2028 chances significantly'],
    ['KXIMPEACH-29',    'KXPRESPARTY-2028',  'negative', 0.50, 'Impeachment creates GOP headwinds in 2028'],
    ['KXGDPUSMAX-28',   'KXPRESPARTY-2028',  'positive', 0.60, 'Strong Trump economy boosts GOP 2028 odds'],
    ['KXU3MAX-30',      'KXPRESPARTY-2028',  'negative', 0.55, 'High unemployment hurts party in power in 2028'],
  ]

  let created = 0, skipped = 0

  for (const [eventA, eventB, relType, weight, notes] of RELATIONSHIPS) {
    const marketA = getEventMarket(eventA)
    const marketB = getEventMarket(eventB)

    if (!marketA) { console.log(`  - skip: no market for ${eventA}`); skipped++; continue }
    if (!marketB) { console.log(`  - skip: no market for ${eventB}`); skipped++; continue }

    const { error: relError } = await supabase
      .from('market_relationships')
      .upsert({
        market_a_id: marketA.id,
        market_b_id: marketB.id,
        relationship_type: relType,
        weight,
        notes,
      }, { onConflict: 'market_a_id,market_b_id' })

    if (!relError) {
      console.log(`  ✓ ${eventA} → ${eventB} (${relType}, ${weight})`)
      created++
    } else {
      console.error(`  ✗ ${eventA} → ${eventB}: ${relError.message}`)
    }
  }

  console.log(`\n✅ Relationships: ${created} created, ${skipped} skipped\n`)
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🌊 Cascade Sync')
  console.log('===============')

  if (!KALSHI_KEY) { console.error('❌ KALSHI_API_KEY not set in .env.local'); process.exit(1) }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { console.error('❌ Supabase env vars missing'); process.exit(1) }

  const marketsOnly = process.argv.includes('--markets-only')

  await syncMarkets()
  if (!marketsOnly) await seedRelationships()

  console.log('🎉 Done! Open /scenario or /top to see results.')
}

main().catch(console.error)
