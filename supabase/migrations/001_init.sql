-- Markets: cached data from Kalshi and Polymarket
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

-- Market relationships: the core of the conditional probability engine
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

-- Scenarios: saved trees (Pro tier)
create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  assumed_event_id uuid references markets(id) on delete set null,
  snapshot_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Seed: initial high-signal election/macro market relationships
-- (placeholder external_ids — replace with real Kalshi tickers after seeding markets)
-- These are inserted after markets are synced via the API.
