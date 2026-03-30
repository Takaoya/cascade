import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: markets } = await supabase
    .from('markets')
    .select('id, external_id, category')
    .eq('source', 'kalshi')
    .limit(5)

  console.log('Sample markets:', JSON.stringify(markets, null, 2))

  const { count } = await supabase
    .from('market_relationships')
    .select('id', { count: 'exact', head: true })
  console.log('Existing relationship count:', count)

  const { data: trump } = await supabase
    .from('markets')
    .select('id, external_id, category')
    .eq('category', 'KXTRUMPRESIGN')
    .limit(1)
    .single()
  console.log('KXTRUMPRESIGN market:', trump)

  const mA = markets?.[0]
  const mB = markets?.[1]
  if (mA && mB) {
    const { error } = await supabase
      .from('market_relationships')
      .upsert(
        { market_a_id: mA.id, market_b_id: mB.id, relationship_type: 'neutral', weight: 0.1, notes: 'test' },
        { onConflict: 'market_a_id,market_b_id' }
      )
    console.log('Test upsert error:', error?.message ?? 'none (success)')
    if (!error) {
      await supabase.from('market_relationships').delete().eq('market_a_id', mA.id).eq('market_b_id', mB.id)
      console.log('Cleaned up test row')
    }
  }
}

main().catch(console.error)
