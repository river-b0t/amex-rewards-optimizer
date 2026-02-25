# Design: Dashboard Overhaul + Offer Value Scoring

> Date: 2026-02-25
> Status: Approved

---

## Overview

Two features:
1. **Dashboard overhaul** — Replace the bare home page with a command center showing expiring offers (with inline enroll) and benefit status for the current period.
2. **Offer value scoring** — Add a `% Return` column and sort to the /offers table.

---

## Feature A: Dashboard Overhaul

### Goal
Make the dashboard the primary daily-use screen. Two primary actions: enroll in expiring high-value offers, see which benefits to use this month.

### Layout

```
[ Enrolled Offers ] [ Expiring in 14d ] [ Benefits Remaining ] [ Value Captured YTD ]
       stat card          stat card             stat card               stat card

[ Expiring Offers (top 10 by value, next 14d) ] [ Benefits This Period (enrolled) ]
  Merchant | Reward | % Return | Expires | Enroll  Name | Remaining | Period ends | Bar
  ...                                            ...
  → View all offers                              → Manage benefits
```

### Stat Cards (4)

| Card | Data source |
|------|-------------|
| Enrolled offers | COUNT from `enrolled_offers` JOIN `amex_offers` WHERE active |
| Expiring in 14 days | COUNT from `amex_offers` WHERE expiration_date <= now+14d AND active AND NOT enrolled |
| Benefits remaining | SUM of (amount_cents - used_cents) for enrolled benefits in current period |
| Value captured YTD | SUM of reward_amount_cents from completed enrolled_offers + SUM of used benefit amounts this year |

### Expiring Offers Panel

- Filter: `amex_offers` WHERE `expiration_date` BETWEEN today AND today+14d AND `active = true`
- Exclude: already-enrolled offers
- Sort: `reward_amount_cents DESC` (top 10)
- Columns: Merchant | Reward | % Return | Expires in X days | [Enroll] button
- Enroll button: calls existing `POST /api/offers/enroll`, optimistic UI update
- Footer: "View all offers →" link to /offers

### Benefits This Period Panel

- Filter: enrolled benefits only (`enrolled = true`)
- Compute per benefit: remaining = `amount_cents - SUM(usage for current period_key)`
- Sort: by remaining cents DESC (most uncaptured value first)
- Columns: Benefit name | Remaining $ | Days until period reset | Progress bar
- Footer: "Manage benefits →" link to /benefits

### Data Architecture

New server-side API route: `GET /api/dashboard`

Returns:
```typescript
{
  stats: {
    enrolledOffersCount: number
    expiringOffersCount: number        // unenrolled, within 14d
    benefitsRemainingCents: number     // enrolled benefits, current period
    valueCapturedYTDCents: number
  }
  expiringOffers: Array<{
    id: string
    merchant: string
    reward_amount_cents: number
    spend_min_cents: number | null
    expiration_date: string
    reward_type: 'cash' | 'points'
  }>
  benefitsSummary: Array<{
    id: string
    name: string
    amount_cents: number
    used_cents: number
    reset_period: string
    period_ends: string               // ISO date of period end
    category: string
  }>
}
```

Dashboard page (`app/page.tsx`) becomes a server component that awaits `fetch('/api/dashboard')`. Enroll button on expiring offers is a client component island for interactivity.

---

## Feature C: Offer Value Scoring

### Goal
Help users identify high-efficiency offers — ones with a high reward relative to required spend.

### Implementation

**New column: `% Return`**
- Computed client-side in `OffersTable`: `(reward_amount_cents / spend_min_cents) * 100`
- Displayed as integer percentage: "25%", "50%", etc.
- If `spend_min_cents` is null or 0: display "—", sort to bottom
- Points offers: display "—" (cash-equivalent % not meaningful for MR points without $ value)

**New sort pill: `% Return`**
- Added to existing sort pills row alongside: Reward ↓, Expiry ↑, Merchant A–Z
- Sorts descending (highest % first), null/zero min-spend at bottom
- No DB changes or migration needed — all computed from existing columns

### Column order (updated offers table)

Merchant | Reward | Min Spend | **% Return** | Expires | Status | Action

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/app/api/dashboard/route.ts` | New — dashboard data endpoint |
| `src/app/page.tsx` | Rewrite — server component with two panels + stat cards |
| `src/components/dashboard/StatCard.tsx` | New — reusable stat card |
| `src/components/dashboard/ExpiringOffersPanel.tsx` | New — expiring offers with inline enroll |
| `src/components/dashboard/BenefitsSummaryPanel.tsx` | New — benefits this period |
| `src/app/offers/page.tsx` | Add % Return column + sort pill |

---

## Out of Scope

- Auth / login flow
- Sync history UI
- Mobile nav overhaul
- Multi-card support
