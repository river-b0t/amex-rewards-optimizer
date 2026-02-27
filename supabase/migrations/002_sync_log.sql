-- supabase/migrations/002_sync_log.sql

create table sync_log (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('offers_scrape', 'budget_sync')),
  ran_at timestamptz not null default now(),
  records_processed int not null default 0,
  records_updated int,
  error text
);

create index sync_log_ran_at_idx on sync_log (ran_at desc);
