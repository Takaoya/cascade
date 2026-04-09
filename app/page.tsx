import { createServiceClient } from '@/lib/supabase'
import Landing from './landing'

async function getStats() {
  try {
    const supabase = createServiceClient()
    const [{ count: markets }, { count: relationships }] = await Promise.all([
      supabase.from('markets').select('*', { count: 'exact', head: true }).eq('source', 'kalshi'),
      supabase.from('market_relationships').select('*', { count: 'exact', head: true }),
    ])
    return { markets: markets ?? 0, relationships: relationships ?? 0 }
  } catch {
    return { markets: 0, relationships: 0 }
  }
}

export default async function Home() {
  const stats = await getStats()
  return <Landing markets={stats.markets} relationships={stats.relationships} />
}
