# Design: UX Polish — Logout, Offers Cleanup, Benefits Partial Usage

> Date: 2026-02-25
> Status: Approved

## Overview

Three small UX improvements: add a logout button, remove dead filter/sort placeholder buttons, and add partial usage logging to benefit cards.

## Feature 1: Logout

**Auth mechanism:** Cookie-based (`site-auth` cookie set by `POST /api/login`).

**Changes:**
- Add `POST /api/logout` route — clears `site-auth` cookie, returns `{ ok: true }`
- Add `LogoutButton` client component (`src/components/logout-button.tsx`) — calls the route, then `window.location.href = '/login'`
- Add `<LogoutButton />` to `src/components/nav.tsx` — right-aligned via `ml-auto`

Nav stays a server component; `LogoutButton` is the only client island.

## Feature 2: Offers Filter/Sort Cleanup

**What's wrong:** Two placeholder "Sort" and "Filter" buttons in the header of `OffersTable` (lines 341–347 of `src/components/offers/OfferCard.tsx`) do nothing. The real sort pills and filter chips in the toolbar below already work.

**Change:** Delete those two buttons. No other changes.

## Feature 3: Benefits Partial Usage

**Current state:** `BenefitCard` has a "Mark fully used" button that posts `remaining_cents` to `POST /api/benefits/usage`. The API already accepts any `amount_used_cents`.

**Change:** Replace the single "Mark fully used" button with two side-by-side options:
- "Mark fully used" — unchanged behavior
- Inline `$___` input (number, max = remaining dollars) + "Log" button — posts the entered amount in cents to the same endpoint, caps at `remaining_cents`

Input shows on click of a small "Log partial" link/button. On success, updates `usedCents` state optimistically.

## Files

| File | Change |
|------|--------|
| `src/app/api/logout/route.ts` | New — clears site-auth cookie |
| `src/components/logout-button.tsx` | New — client logout button |
| `src/components/nav.tsx` | Add LogoutButton, right-aligned |
| `src/components/offers/OfferCard.tsx` | Remove 2 dead header buttons |
| `src/components/benefits/BenefitCard.tsx` | Add partial usage input |

## Out of Scope
- Login page restyling
- Sync history UI
