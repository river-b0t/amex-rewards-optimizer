# Design: Enrolled Offer Expiration Alerts

> Date: 2026-02-25
> Status: Approved

## Overview

Extend the dashboard's Expiring Offers panel to show two sections: unenrolled offers to enroll (existing, 14d window) and enrolled-but-incomplete offers about to expire (new, 30d window). Users can see at a glance which enrolled offers they need to spend against before losing them.

## Data

**`GET /api/dashboard` — add `enrolledExpiringOffers`:**
- Query: `enrolled_offers` JOIN `amex_offers` WHERE `expiration_date ≤ now+30d` AND `threshold_met = false` AND `active = true`
- Sort: `expiration_date ASC` (most urgent first)
- No row limit
- Shape:
```typescript
Array<{
  id: string           // enrolled_offers.id
  merchant: string
  reward_amount_cents: number | null
  spend_min_cents: number | null
  expiration_date: string
  reward_type: string
}>
```

## Component

**`ExpiringOffersPanel` changes:**
- Rename prop `offers` → `unenrolledOffers`, add `enrolledOffers` prop
- Section 1 header: "Enroll before they're gone" (unenrolled, 14d)
- GroupRow divider — only renders when `enrolledOffers.length > 0`
- Section 2 header: "Complete before they expire" (enrolled, 30d)
  - Same row grid as section 1
  - No Enroll button; instead shows `$X min · untracked` in muted text (or `No min` if spend_min_cents is null)
  - Days left urgency: red + bold when ≤ 7

**Stat card update:**
- "Expiring in 14d" label → "Expiring Soon"
- subtext → reflects unenrolled count only (enrolled expiry is separate concern)

## Files

| File | Change |
|------|--------|
| `src/app/api/dashboard/route.ts` | Add `enrolledExpiringOffers` query + field |
| `src/components/dashboard/ExpiringOffersPanel.tsx` | Two-section layout, renamed prop |
| `src/app/page.tsx` | Pass `enrolledExpiringOffers` to panel |

## Out of Scope
- Spend tracking against enrolled offers (deferred until transaction history integration)
- Push notifications / email alerts
