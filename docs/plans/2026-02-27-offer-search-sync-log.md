# Offer Search + Sync Log Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add text search to the offers table and a sync history panel to the dashboard backed by a new `sync_log` Supabase table.

**Architecture:** Client-side offer search filters the already-loaded in-memory offers array. The sync log table is written by all three sync endpoints on success/error and read by the dashboard server component directly via Supabase.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Supabase (PostgreSQL), shadcn/ui not used (native Tailwind only).

---

## Task 1: Create sync_log migration

**Files:**
- Create: `supabase/migrations/002_sync_log.sql`

**Step 1: Create the migration file**

```sql
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
```

**Step 2: Run in Supabase SQL editor**

Go to Supabase Dashboard → SQL Editor → paste and run the migration.
Expected: table `sync_log` created with the index.

**Step 3: Commit**

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
git add supabase/migrations/002_sync_log.sql
git commit -m "feat: add sync_log migration"
```

---

## Task 2: Add offer text search to OffersTable

**Files:**
- Modify: `src/components/offers/OfferCard.tsx`

The `OffersTable` component already has filter/sort state. We add `searchQuery` state, a search input row in the toolbar, and filter the offers array before the existing pipeline.

**Step 1: Add searchQuery state**

In `OffersTable`, after the existing `useState` declarations (around line 280), add:

```typescript
const [searchQuery, setSearchQuery] = useState('')
```

**Step 2: Add search filter to the `filtered` useMemo**

Replace the existing `filtered` useMemo (starts around line 317):

```typescript
const filtered = useMemo(() => {
  // Always drop expired
  let result = offers.filter((o) => !o.expiration_date || daysUntil(o.expiration_date) >= 0)

  // Text search on merchant + description
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    result = result.filter(
      (o) =>
        o.merchant.toLowerCase().includes(q) ||
        (o.description?.toLowerCase().includes(q) ?? false)
    )
  }

  if (filterBy === 'enrolled') result = result.filter((o) => o.is_enrolled)
  else if (filterBy === 'expiring') result = result.filter((o) => isExpiringSoon(o.expiration_date))
  else if (filterBy !== 'all')
    result = result.filter((o) => getCategory(o.merchant).label === filterBy)
  return result
}, [offers, filterBy, searchQuery])
```

**Step 3: Reset visibleCount when searchQuery changes**

Add a `useEffect` after the `filtered` useMemo:

```typescript
useEffect(() => {
  setVisibleCount(PAGE_SIZE)
}, [searchQuery])
```

Add `useEffect` to the imports at the top: `import { useState, useMemo, useCallback, useEffect } from 'react'`

**Step 4: Add search input row in the JSX**

In the `return` block, between the toolbar `div` (ends around the `</div>` closing the filter chips) and the table `div`, add:

```tsx
{/* ── Search ── */}
<div className="relative mb-3">
  <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder="Search merchants…"
    className="w-full text-[13px] border border-gray-200 rounded-md px-3 py-2 pr-8 focus:outline-none focus:border-gray-400 placeholder-gray-300"
  />
  {searchQuery && (
    <button
      onClick={() => setSearchQuery('')}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[16px] leading-none"
      aria-label="Clear search"
    >
      ×
    </button>
  )}
</div>
```

**Step 5: Verify manually**

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npm run dev
```

- Open http://localhost:3000/offers
- Type "amazon" in search box — only Amazon offers appear
- Type a partial match like "star" — Starbucks etc. appear
- Click × — all offers return
- Combine search with a filter chip — both apply

**Step 6: Commit**

```bash
git add src/components/offers/OfferCard.tsx
git commit -m "feat: add client-side text search to offers table"
```

---

## Task 3: Add sync_log inserts to all three sync routes

**Files:**
- Modify: `src/app/api/offers/sync/route.ts`
- Modify: `src/app/api/offers/sync-now/route.ts`
- Modify: `src/app/api/transactions/budget-sync/route.ts`

All three follow the same pattern: after the main logic, insert a row into `sync_log`. On error, insert a row with `error` set.

### 3a: `/api/offers/sync/route.ts`

The `handleSync` function. Insert before the final `return` in the success path, and in the catch block.

**In the success path**, replace the final return:

```typescript
// Insert sync log row
await supabase.from('sync_log').insert({
  type: 'offers_scrape',
  records_processed: offers.length,
  error: null,
})

return NextResponse.json({
  synced: offers.length,
  timestamp: new Date().toISOString(),
})
```

**In the catch block**, before `return NextResponse.json({ error: String(err) }, ...)`:

```typescript
// Log failed run
try {
  const supabase = createServiceClient()
  await supabase.from('sync_log').insert({
    type: 'offers_scrape',
    records_processed: 0,
    error: String(err),
  })
} catch { /* ignore log failure */ }
```

Also handle the "0 offers" early return — it's not an error but worth logging:

```typescript
if (offers.length === 0) {
  await supabase.from('sync_log').insert({
    type: 'offers_scrape',
    records_processed: 0,
    error: 'No offers scraped',
  })
  return NextResponse.json(
    { synced: 0, message: 'No offers scraped', timestamp: new Date().toISOString() },
    { status: 200 }
  )
}
```

### 3b: `/api/offers/sync-now/route.ts`

Same pattern as 3a (same logic, same inserts). `supabase` is already imported via `createServiceClient`.

**In the success path**, after the `update { active: false }` call:

```typescript
await supabase.from('sync_log').insert({
  type: 'offers_scrape',
  records_processed: offers.length,
  error: null,
})

return NextResponse.json({
  synced: offers.length,
  timestamp: new Date().toISOString(),
})
```

**In the catch block**:

```typescript
try {
  const supabase = createServiceClient()
  await supabase.from('sync_log').insert({
    type: 'offers_scrape',
    records_processed: 0,
    error: String(err),
  })
} catch { /* ignore */ }
```

### 3c: `/api/transactions/budget-sync/route.ts`

**In the success path**, after `benefitsSynced` is tallied, before the final return:

```typescript
await supabase.from('sync_log').insert({
  type: 'budget_sync',
  records_processed: transactions.length,
  records_updated: offersUpdated + benefitsSynced,
  error: null,
})

return NextResponse.json({
  transactions_processed: transactions.length,
  offers_updated: offersUpdated,
  offers_completed: offersCompleted,
  benefits_synced: benefitsSynced,
  synced_at: syncedAt,
})
```

**In the catch block**:

```typescript
try {
  const supabase = createServiceClient()
  await supabase.from('sync_log').insert({
    type: 'budget_sync',
    records_processed: 0,
    error: String(err),
  })
} catch { /* ignore */ }
console.error('[budget-sync] error:', err)
return NextResponse.json({ error: String(err) }, { status: 500 })
```

**Step: Commit**

```bash
git add src/app/api/offers/sync/route.ts \
        src/app/api/offers/sync-now/route.ts \
        src/app/api/transactions/budget-sync/route.ts
git commit -m "feat: log all sync runs to sync_log table"
```

---

## Task 4: Create /api/sync-log GET endpoint

**Files:**
- Create: `src/app/api/sync-log/route.ts`

This endpoint is used for debugging and future client-side use. The dashboard page queries Supabase directly.

**Step 1: Create the route**

```typescript
// src/app/api/sync-log/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export type SyncLogRow = {
  id: string
  type: 'offers_scrape' | 'budget_sync'
  ran_at: string
  records_processed: number
  records_updated: number | null
  error: string | null
}

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sync_log')
    .select('id, type, ran_at, records_processed, records_updated, error')
    .order('ran_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ rows: [] })
  return NextResponse.json({ rows: data ?? [] })
}
```

**Step 2: Commit**

```bash
git add src/app/api/sync-log/route.ts
git commit -m "feat: add /api/sync-log endpoint"
```

---

## Task 5: Create SyncHistoryPanel component

**Files:**
- Create: `src/components/dashboard/SyncHistoryPanel.tsx`

**Step 1: Create the component**

```typescript
// src/components/dashboard/SyncHistoryPanel.tsx
'use client'

import { useState } from 'react'

export type SyncLogRow = {
  id: string
  type: 'offers_scrape' | 'budget_sync'
  ran_at: string
  records_processed: number
  records_updated: number | null
  error: string | null
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

function typeLabel(type: string): string {
  return type === 'offers_scrape' ? 'Offers scrape' : 'Budget sync'
}

function recordSummary(row: SyncLogRow): string {
  if (row.error) return row.error.length > 40 ? row.error.slice(0, 40) + '…' : row.error
  if (row.type === 'offers_scrape') return `${row.records_processed} offers`
  const updated = row.records_updated ?? 0
  return `${row.records_processed} txns · ${updated} updated`
}

export function SyncHistoryPanel({ rows }: { rows: SyncLogRow[] }) {
  const [expanded, setExpanded] = useState(false)

  // Last run per type for summary view
  const lastOffersScrape = rows.find((r) => r.type === 'offers_scrape')
  const lastBudgetSync = rows.find((r) => r.type === 'budget_sync')
  const summaryRows = [lastOffersScrape, lastBudgetSync].filter(Boolean) as SyncLogRow[]

  const displayRows = expanded ? rows.slice(0, 10) : summaryRows

  if (rows.length === 0) return null

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] border-b border-gray-200">
        <h2 className="text-[13px] font-semibold text-gray-700">Sync History</h2>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? 'Show less' : 'Show history'}
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {displayRows.map((row) => (
          <div key={row.id} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span
                className={[
                  'w-[6px] h-[6px] rounded-full shrink-0',
                  row.error ? 'bg-red-400' : 'bg-green-500',
                ].join(' ')}
              />
              <span className="text-[13px] text-gray-700">{typeLabel(row.type)}</span>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={`text-[12px] ${row.error ? 'text-red-500' : 'text-gray-400'}`}
              >
                {recordSummary(row)}
              </span>
              <span className="text-[12px] text-gray-400 tabular-nums w-[52px] text-right">
                {formatRelativeTime(row.ran_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/SyncHistoryPanel.tsx
git commit -m "feat: add SyncHistoryPanel component"
```

---

## Task 6: Add SyncHistoryPanel to dashboard page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add sync log data fetch**

In `DashboardPage`, after the `lastSyncRow` query (around line 151), add:

```typescript
const { data: syncLogRows } = await supabase
  .from('sync_log')
  .select('id, type, ran_at, records_processed, records_updated, error')
  .order('ran_at', { ascending: false })
  .limit(20)
```

**Step 2: Add import at the top**

Add to the imports at the top of `page.tsx`:

```typescript
import { SyncHistoryPanel } from '@/components/dashboard/SyncHistoryPanel'
import type { SyncLogRow } from '@/components/dashboard/SyncHistoryPanel'
```

**Step 3: Add to JSX**

After the closing `</div>` of the 2-column grid (the one with `ExpiringOffersPanel` and `BenefitsSummaryPanel`), add:

```tsx
<SyncHistoryPanel rows={(syncLogRows ?? []) as SyncLogRow[]} />
```

The outer `space-y-6` div handles spacing automatically.

**Step 4: Verify manually**

```bash
npm run dev
```

- Trigger a sync (click "Sync transactions" on dashboard, or "Sync now" on offers page)
- Reload dashboard — SyncHistoryPanel should appear below the two panels
- Trigger a second sync type — both rows show in summary view
- Click "Show history" — all recent runs appear in expanded list
- Any error run should show red dot + truncated error message

**Step 5: Build check**

```bash
npm run build
```

Expected: clean build with no TypeScript errors.

**Step 6: Commit and push**

```bash
git add src/app/page.tsx
git commit -m "feat: add sync history panel to dashboard"
git push
```

---

## Verification Checklist

- [ ] `sync_log` table exists in Supabase with correct columns
- [ ] Offer search filters by merchant + description, clear button works
- [ ] Budget sync inserts a `sync_log` row visible in Supabase
- [ ] Offers scrape inserts a `sync_log` row (trigger via "Sync now" on offers page)
- [ ] Dashboard shows SyncHistoryPanel with last run per type
- [ ] "Show history" expands to last 10 runs
- [ ] Error runs show red dot + message
- [ ] `npm run build` passes cleanly
- [ ] Deployed to Vercel and working in production
