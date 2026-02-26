# Design: Polish Round 2 — Login Styling, Manual Sync, Escape to Cancel

> Date: 2026-02-25
> Status: Approved

## Feature 1: Login Page Styling

Restyle `src/app/login/page.tsx` to match the app's aesthetic (white bg, Tailwind, shadcn/ui Input + Button). Centered card layout with app name, tagline, password field, submit button, inline error.

## Feature 2: Manual Sync Button

`POST /api/offers/sync` requires `Authorization: Bearer <CRON_SECRET>` — not callable from the browser. Create a new `POST /api/offers/sync-now` route that relies on cookie auth (middleware) instead. Calls same scraper + upsert logic.

Button in the offers page header next to "synced Xh ago". Shows loading state. On success: `router.refresh()` to update the table and timestamp.

**Files:**
- Create: `src/app/api/offers/sync-now/route.ts`
- Modify: `src/components/offers/OfferCard.tsx` — add sync button + handler

## Feature 3: Escape to Cancel (BenefitCard partial input)

Extend the existing `onKeyDown` on the partial usage input to handle `Escape`:

```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter') logPartialUsage()
  if (e.key === 'Escape') { setShowPartial(false); setPartialInput('') }
}}
```

**File:** `src/components/benefits/BenefitCard.tsx`

## Files

| File | Change |
|------|--------|
| `src/app/login/page.tsx` | Restyle with shadcn/ui + Tailwind |
| `src/app/api/offers/sync-now/route.ts` | New — cookie-auth sync trigger |
| `src/components/offers/OfferCard.tsx` | Add manual sync button |
| `src/components/benefits/BenefitCard.tsx` | Escape key cancels partial input |
