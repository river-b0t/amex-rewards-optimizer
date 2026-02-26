# Design: Optimizer Upgrade — Free-Text Search + Earn Rate Breakdown

> Date: 2026-02-25
> Status: Approved

## Overview

Upgrade `/optimizer` to support free-text search (merchant names and category keywords) with fuzzy matching, and show a full earn rate breakdown per card result.

## Matching

**`src/lib/optimizer.ts` changes:**

- Add `MERCHANT_ALIASES: Record<string, string>` (~50 entries mapping merchant names → category slugs)
  - Examples: uber → rideshare, lyft → rideshare, whole foods → grocery, safeway → grocery, alaska airlines → alaska_airlines, delta → flights, hilton → prepaid_hotels, amtrak → transit, etc.
- Add `resolveCategory(query: string, knownCategories: string[]): string`:
  1. Normalize: `query.toLowerCase().trim()`
  2. Check alias map
  3. Substring match: find first category slug that includes the query, or query includes the slug
  4. Fall back to `everything_else`
- Update `getBestCard` → `getCardResults(query, cards)`:
  - Returns array of `CardResult[]` sorted by matched earn rate desc
  - Each result: `{ card, matched_category, matched_earn_rate, matched_earn_type, other_categories }`
  - `other_categories`: all card categories except matched, sorted by earn_rate desc, top 4

## Results UI

**`src/app/optimizer/page.tsx` changes:**
- Preset buttons unchanged (pass exact slugs, skip fuzzy matching)
- Results card: matched rate prominent at top ("3x on alaska_airlines")
- Below: top 3-4 other category rates as smaller rows

## API

**`src/app/api/optimizer/route.ts`:**
- Same endpoint: `GET /api/optimizer?category=`
- No interface change — just passes through richer `CardResult` shape

## Files

| File | Change |
|------|--------|
| `src/lib/optimizer.ts` | Add alias map, resolveCategory, update return type |
| `src/app/api/optimizer/route.ts` | Pass through richer CardResult |
| `src/app/optimizer/page.tsx` | Update results display with breakdown |

## Out of Scope
- DB-backed merchant alias table
- Levenshtein/typo tolerance
- AI/embedding-based matching
