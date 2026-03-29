/**
 * Runs the DB migration against Supabase using the service role key.
 * Usage: npx tsx scripts/migrate.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SQL = `
create table if not exists markets (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('kalshi', 'polymarket')),
  external_id text not null,
  title text not null,
  probability numeric(5,4) not null check (probability >= 0 and probability <= 1),
  category text,
  last_updated timestamptz not null default now(),
  unique (source, external_id)
);

create table if not exists market_relationships (
  id uuid primary key default gen_random_uuid(),
  market_a_id uuid not null references markets(id) on delete cascade,
  market_b_id uuid not null references markets(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('positive', 'negative', 'neutral')),
  weight numeric(4,3) not null check (weight >= 0 and weight <= 1),
  notes text,
  created_at timestamptz not null default now(),
  unique (market_a_id, market_b_id)
);

create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  assumed_event_id uuid references markets(id) on delete set null,
  snapshot_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);
`

async function main() {
  console.log('Running migration...')
  const { error } = await supabase.rpc('exec_sql', { sql: SQL }).single()
  if (error) {
    // Try direct REST approach
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        body: JSON.stringify({ sql: SQL }),
      }
    )
    if (!res.ok) {
      console.error('RPC not available. Please run the SQL manually in Supabase SQL Editor.')
      console.error('File: supabase/migrations/001_init.sql')
      process.exit(1)
    }
  }
  console.log('✅ Migration complete')
}

main().catch(console.error)
