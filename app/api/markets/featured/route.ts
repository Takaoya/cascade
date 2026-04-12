import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Domain buckets — each featured example should come from a different bucket
// so the five examples tell five genuinely different stories to five different
// user types. Add new category prefixes here as more relationships are mapped.
const DOMAINS: Record<string, string[]> = {
  political:    ['KXTRUMPRESIGN', 'KXIMPEACH', 'KXTRUMPREMOVE', 'KXHABEAS', 'KXAMEND25', 'KXDEMOCRACY', 'KXSCOTUS', 'KXSCOURT', 'KXPRESPARTY', 'KXPRESPERSON', 'KXFULLTERMSK'],
  monetary:     ['KXFEDEND', 'KXBALANCE', 'KXCAPCONTROL'],
  trade:        ['KXFTAPRC', 'KXFTA', 'CHINAUSGDP'],
  fiscal:       ['KXGOVTCUTS', 'KXGDPUSMAX', 'KXGDPSHAREMANU', 'KXDEBTGROWTH', 'KXU3MAX', 'KXINEQUALITY'],
  geopolitical: ['KXZELENSKYPUTIN', 'KXTAIWANLVL4', 'KXUSAKIM', 'KXWITHDRAW', 'KXABRAHAMSA', 'KXRECOGROC', 'KXHORMUZNORM', 'KXCANTERRITORY', 'KXGREENTERRITORY', 'KXUSAEXPAND'],
}

function classifyDomain(category: string): string {
  const cat = (category ?? '').toUpperCase()
  for (const [domain, prefixes] of Object.entries(DOMAINS)) {
    if (prefixes.some(p => cat.startsWith(p))) return domain
  }
  return 'other'
}

// GET /api/markets/featured
// Returns one market per domain (political, monetary, trade, fiscal,
// geopolitical), each with the highest cross-category relationship count
// within its domain. Guarantees diverse, interesting examples.
export async function GET() {
  const supabase = createServiceClient()

  const { data: rels, error } = await supabase
    .from('market_relationships')
    .select(`
      market_a_id,
      market_a:markets!market_relationships_market_a_id_fkey(id, title, category, probability, external_id, source),
      market_b:markets!market_relationships_market_b_id_fkey(id, title, category)
    `)
    .limit(1000)

  if (error || !rels?.length) {
    return NextResponse.json({ markets: [] })
  }

  // Score each market_a by cross-category relationship count
  const scores: Record<string, {
    market: Record<string, unknown>
    domain: string
    total: number
    cross: number
  }> = {}

  for (const r of rels) {
    const a = r.market_a as unknown as Record<string, unknown> | null
    const b = r.market_b as unknown as Record<string, unknown> | null
    if (!a || !b) continue

    if (!scores[r.market_a_id]) {
      scores[r.market_a_id] = {
        market: a,
        domain: classifyDomain(a.category as string),
        total: 0,
        cross: 0,
      }
    }

    scores[r.market_a_id].total++
    if (b.category !== a.category) scores[r.market_a_id].cross++
  }

  // Within each domain, pick the market with the most cross-category rels.
  // Domain order sets the display priority.
  const DOMAIN_ORDER = ['political', 'monetary', 'trade', 'geopolitical', 'fiscal', 'other']
  const byDomain: Record<string, typeof scores[string]> = {}

  for (const entry of Object.values(scores)) {
    if (entry.cross === 0) continue // must have at least one genuine cross-market signal
    const existing = byDomain[entry.domain]
    if (!existing || entry.cross > existing.cross || (entry.cross === existing.cross && entry.total > existing.total)) {
      byDomain[entry.domain] = entry
    }
  }

  const featured = DOMAIN_ORDER
    .map(d => byDomain[d])
    .filter(Boolean)
    .slice(0, 5)
    .map(e => e.market)

  return NextResponse.json(
    { markets: featured },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}
