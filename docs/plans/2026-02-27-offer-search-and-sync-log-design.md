# Design: Offer Search + Sync Log

Date: 2026-02-27

---

## Feature 1: Offer Search on Offers Page

### Summary
Add a client-side text search input to the `OffersTable` component. All offer data is already in memory, so no API changes are needed.

### Behavior
- Search input filters by `merchant` + `description` fields (case-insensitive substring match)
- Filtering runs before the existing filter chips and sort pipeline
- A clear (×) button appears when the query is non-empty
- Footer shows result count as normal
- Resets `visibleCount` to `PAGE_SIZE` when query changes

### Placement
A full-width search row below the sort/filter toolbar, above the table — the toolbar row is too dense to absorb another control.

### Files Modified
- `src/components/offers/OfferCard.tsx` — add `searchQuery` state, search input UI, filter logic

---

## Feature 2: Sync Log (Dashboard Panel)

### Summary
Track every sync run in Supabase and display a history panel on the dashboard page.

### Data Model

**New Supabase table: `sync_log`**

| Column              | Type        | Notes                              |
|---------------------|-------------|------------------------------------|
| `id`                | uuid PK     | `gen_random_uuid()`                |
| `type`              | text        | `'offers_scrape'` or `'budget_sync'` |
| `ran_at`            | timestamptz | `default now()`                    |
| `records_processed` | int         | Offers scraped or transactions read |
| `records_updated`   | int nullable | Offers/benefits updated (budget sync only) |
| `error`             | text nullable | Error message if run failed       |

### Write Path
Three sync endpoints insert a row on both success and error:

1. `/api/offers/sync` (cron scrape) — `type: 'offers_scrape'`
2. `/api/offers/sync-now` (manual scrape) — `type: 'offers_scrape'`
3. `/api/transactions/budget-sync` — `type: 'budget_sync'`

On success: set `records_processed`, `records_updated` (budget sync), `error: null`.
On error: set `records_processed: 0`, `error: <message>`.

### Read Path
New GET endpoint `/api/sync-log` returns last 20 rows ordered by `ran_at desc`. No auth required (same pattern as other dashboard data endpoints).

### UI
New `SyncHistoryPanel` component on the dashboard page, below `BudgetSyncButton`.

**Collapsed view (default):** 2-row summary showing the most recent run of each type:
```
Offers scrape   2h ago · 847 offers
Budget sync     5h ago · 3 updated
```

**Expanded view (toggle):** Last 10 runs in a compact table:
```
Time     | Type           | Records | Status
---------|----------------|---------|-------
2h ago   | Offers scrape  | 847     | ✓
5h ago   | Budget sync    | 3 upd.  | ✓
1d ago   | Offers scrape  | 831     | ✓
...
```

Errors show in red with the error message truncated.

### Files

**New:**
- `src/app/api/sync-log/route.ts` — GET handler
- `src/components/dashboard/SyncHistoryPanel.tsx` — UI component

**Modified:**
- `src/app/api/offers/sync/route.ts` — insert sync_log row
- `src/app/api/offers/sync-now/route.ts` — insert sync_log row
- `src/app/api/transactions/budget-sync/route.ts` — insert sync_log row
- `src/app/page.tsx` — fetch sync log data, render `SyncHistoryPanel`
