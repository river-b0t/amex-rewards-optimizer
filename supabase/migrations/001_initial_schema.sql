-- Cards
create table cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  network text not null,
  reward_currency text not null, -- 'MR' | 'miles' | 'cashback'
  color text,
  created_at timestamptz default now()
);

-- Earning rates per card per category
create table card_categories (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  category_name text not null,
  earn_rate numeric not null,
  earn_type text not null,       -- 'multiplier' | 'percent'
  quarterly_limit_cents int,
  notes text,
  active boolean default true
);

-- Amex Platinum benefit definitions
create table amex_benefits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  amount_cents int not null,
  reset_period text not null,    -- 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | '4-year'
  category text not null,        -- 'travel' | 'dining' | 'shopping' | 'wellness' | 'entertainment' | 'other'
  enrolled boolean default false,
  enrollment_required boolean default false,
  enrollment_url text,
  sort_order int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- Usage records
create table benefit_usage (
  id uuid primary key default gen_random_uuid(),
  benefit_id uuid references amex_benefits(id) on delete cascade,
  amount_used_cents int not null,
  period_key text not null,      -- '2026-03' | '2026-Q1' | '2026-H1' | '2026'
  notes text,
  source text default 'manual',  -- 'manual' | 'csv'
  created_at timestamptz default now()
);

-- Scraped Amex Offers
create table amex_offers (
  id uuid primary key default gen_random_uuid(),
  merchant text not null,
  description text,
  spend_min_cents int,
  reward_amount_cents int,
  reward_type text,              -- 'cash' | 'points'
  expiration_date date,
  active boolean default true,
  scraped_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (merchant, expiration_date, reward_amount_cents)
);

-- Offers enrolled on your card
create table enrolled_offers (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references amex_offers(id) on delete cascade,
  enrolled_at timestamptz default now(),
  spent_amount_cents int default 0,
  threshold_met boolean default false,
  completed_at timestamptz
);

-- Indexes
create index on card_categories(card_id);
create index on benefit_usage(benefit_id);
create index on benefit_usage(period_key);
create index on amex_offers(active, expiration_date);
create index on enrolled_offers(offer_id);
