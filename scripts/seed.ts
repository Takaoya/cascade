/**
 * Cascade seed script
 * Fetches political/economic markets from Kalshi and seeds
 * them into Supabase along with curated relationships.
 *
 * Usage: npx tsx scripts/seed.ts
 * Requires: DB migration 001_init.sql already run in Supabase
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

// Target event tickers — political/economic markets we care about
const TARGET_EVENTS = [
  // Trump admin / politics
  'KXTRUMPRESIGN',
  'KXIMPEACH-29',
  'KXTRUMPREMOVE',
  'KXINSURRECTION-29',
  'KXFEDEND-29',
  'KXDOED-29',
  'KXHABEAS-29',
  'KXMARTIAL-29JAN20',
  'KXAMEND25-29',
  'KXCABOUT-26MAR',
  // Trade / economy
  'KXFTAPRC-29',
  'KXFTA-29',
  'KXBALANCE-29',
  'KXDEBTGROWTH-28DEC31',
  'KXGOVTCUTS-28',
  'KXGDPUSMAX-28',
  'KXGDPSHAREMANU-29',
  'CHINAUSGDP',
  'KXU3MAX-30',
  // Foreign policy
  'KXCANAL-29',
  'KXGREENTERRITORY-29',
  'KXCANTERRITORY-29',
  'KXSTATE-29',
  'KXTAIWANLVL4',
  'KXRECOGROC-29',
  'KXZELENSKYPUTIN-29',
  'KXUSAKIM-29',
  'KXABRAHAMSA-29',
  'KXABRAHAMSY-29',
  // 2028 elections
  'KXPRESPARTY-2028',
  'KXPRESPERSON-28',
  'POWER-28',
]

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchKalshiMarkets(eventTicker: string) {
  await sleep(200) // respect rate limits
  const res = await fetch(`${KALSHI_BASE}/markets?event_ticker=${eventTicker}&limit=10&status=open`, {
    headers: { Authorization: `Bearer ${KALSHI_KEY}` },
  })
  if (!res.ok) {
    console.warn(`  ⚠ Kalshi ${eventTicker}: ${res.status}`)
    return []
  }
  const data = await res.json()
  return data.markets ?? []
}

function getPrice(market: any): number {
  const bid = parseFloat(market.yes_bid_dollars) || 0
  const ask = parseFloat(market.yes_ask_dollars) || 0
  if (bid > 0 && ask > 0) return (bid + ask) / 2
  return parseFloat(market.last_price_dollars) || 0
}

async function seedMarkets() {
  console.log('\n📥 Fetching markets from Kalshi...\n')

  const allMarkets: any[] = []

  for (const eventTicker of TARGET_EVENTS) {
    const markets = await fetchKalshiMarkets(eventTicker)
    if (markets.length > 0) {
      console.log(`  ✓ ${eventTicker}: ${markets.length} market(s)`)
      allMarkets.push(...markets)
    } else {
      console.log(`  - ${eventTicker}: no open markets`)
    }
  }

  if (allMarkets.length === 0) {
    console.error('\n❌ No markets found. Check your API key.')
    process.exit(1)
  }

  // Build upsert rows
  const rows = allMarkets.map((m: any) => ({
    source: 'kalshi',
    external_id: m.ticker,
    title: m.title,
    probability: Math.min(1, Math.max(0, getPrice(m))),
    category: m.event_ticker,
    last_updated: new Date().toISOString(),
  }))

  console.log(`\n💾 Upserting ${rows.length} markets into Supabase...`)

  const { error } = await supabase
    .from('markets')
    .upsert(rows, { onConflict: 'source,external_id' })

  if (error) {
    console.error('❌ Supabase error:', error.message)
    console.error('   Make sure you ran the SQL migration first!')
    process.exit(1)
  }

  console.log(`✅ Markets seeded successfully!\n`)
  return rows
}

async function seedRelationships() {
  console.log('🔗 Seeding market relationships...\n')

  // Fetch all markets from DB to get their UUIDs
  const { data: markets, error } = await supabase
    .from('markets')
    .select('id, external_id, title, category')

  if (error || !markets) {
    console.error('❌ Could not fetch markets:', error?.message)
    return
  }

  // Helper: find market by partial ticker or title match
  const findMarket = (externalId: string) =>
    markets.find(m => m.external_id === externalId || m.category === externalId)

  // Find one representative market per event (the most specific / lowest probability)
  const getEventMarket = (eventTicker: string) =>
    markets.find(m => m.category === eventTicker)

  // ─── Relationship definitions ────────────────────────────────────────────
  // Format: [event_a, event_b, relationship_type, weight, notes]
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

  let created = 0
  let skipped = 0

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

    if (relError) {
      // Constraint might not have onConflict — insert instead
      await supabase.from('market_relationships').insert({
        market_a_id: marketA.id,
        market_b_id: marketB.id,
        relationship_type: relType,
        weight,
        notes,
      })
    }
    console.log(`  ✓ ${eventA} → ${eventB} (${relType}, ${weight})`)
    created++
  }

  console.log(`\n✅ Relationships: ${created} created, ${skipped} skipped (event not in DB)\n`)
}

async function main() {
  console.log('🌊 Cascade Seed Script')
  console.log('======================')

  if (!KALSHI_KEY) { console.error('❌ KALSHI_API_KEY not set in .env.local'); process.exit(1) }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { console.error('❌ Supabase env vars missing'); process.exit(1) }

  await seedMarkets()
  await seedRelationships()

  console.log('🎉 Seed complete! Open localhost:3000/scenario to try it.')
}

main().catch(console.error)
