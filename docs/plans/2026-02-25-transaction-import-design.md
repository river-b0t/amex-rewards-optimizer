# Design: Transaction History Import

> Date: 2026-02-25
> Status: Approved

## Goal

Upload Amex CSV transaction history, auto-detect which benefits have been fulfilled and which enrolled offers have hit their minimum spend threshold. Preview matches before committing.

## What Already Exists

- `src/lib/csv-parser.ts` — parses Amex CSV (Date, Description, Amount, Category), has `BENEFIT_PATTERNS` for matching purchases to benefit names
- `src/app/api/benefits/csv-import/route.ts` — writes benefit_usage records with `source: 'csv'` (will be superseded by new endpoints)
- `benefit_usage.source` field already supports 'csv'
- `enrolled_offers.spent_amount_cents` and `threshold_met` fields exist for offer progress

## Architecture

Three new pieces + two modifications:

| File | Change |
|------|--------|
| `src/app/import/page.tsx` | New — client page: upload → preview → confirm |
| `src/app/api/transactions/parse/route.ts` | New — parse CSV, run matchers, return preview (no DB writes) |
| `src/app/api/transactions/import/route.ts` | New — commit matches: write benefit_usage + update enrolled_offers |
| `src/lib/csv-parser.ts` | Add `matchToOffers()` function for offer threshold detection |
| `src/components/nav.tsx` | Add "Import" nav link |

## Import Page Flow

1. File picker — user selects Amex CSV file
2. Client reads CSV as text → POST /api/transactions/parse
3. Preview shown:
   - BENEFIT MATCHES — list of matched transactions with benefit name, amount, date
   - Already-imported items shown with warning, excluded from commit
   - OFFER THRESHOLD MET — enrolled offers that would be marked complete
   - Transaction count total
4. [Cancel] [Confirm import] buttons
5. POST /api/transactions/import → writes to DB
6. Success summary: "X benefit usages recorded, Y offers marked complete"

## Benefit Matching

- Positive amounts (purchases) at benefit merchants → benefit_usage records
- Reuses existing `BENEFIT_PATTERNS` from csv-parser.ts and `matchToBenefit()` function
- Dedup: before inserting, check if benefit_usage with same (benefit_id, period_key, notes) already exists — skip if found, surface count as "already imported"
- Source field set to 'csv'

## Offer Matching (New)

- Fetch all enrolled offers where `threshold_met = false`
- For each offer: sum CSV transaction amounts where description matches the offer's merchant name
- Merchant matching: normalize both sides (lowercase, strip non-alphanumeric), check if offer merchant string appears in transaction description
- If summed spend ≥ spend_min_cents: mark `threshold_met = true`, set `completed_at = now()`, update `spent_amount_cents`
- If spend_min_cents is null (no minimum): skip offer threshold logic

## Amex CSV Format

Columns: `Date, Description, Amount, Category`

- Positive amounts = purchases (money you owe)
- Negative amounts = credits/refunds

The import logic matches PURCHASES (positive amounts) at specific merchants to detect benefit usage and offer threshold progress.

## Future Integration Note

When budget dashboard integration is added: budget dashboard will be the canonical CSV import location. It will POST processed transactions to this app's `/api/transactions/import` endpoint. The optimizer should NOT be the import source — budget dashboard pushes to it.

## Files

| File | Change |
|------|--------|
| `src/app/import/page.tsx` | New client page |
| `src/app/api/transactions/parse/route.ts` | New — preview endpoint |
| `src/app/api/transactions/import/route.ts` | New — commit endpoint |
| `src/lib/csv-parser.ts` | Add matchToOffers() |
| `src/components/nav.tsx` | Add Import link |
