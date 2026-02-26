# Optimizer Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add free-text search with merchant-alias + substring fuzzy matching to the card optimizer, and show a full earn rate breakdown per result card.

**Architecture:** Three-file change — `optimizer.ts` gets alias map + `resolveCategory` + updated `CardResult` type + renamed export; `route.ts` updates the import name; `page.tsx` renders the breakdown rows below each result.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui. No test suite in project — use `npx tsc --noEmit` + `npm run build` for verification.

---

## Reference

Key files:
- `src/lib/optimizer.ts` — 41 lines, has `getBestCard` (exact match only). This is the main change.
- `src/app/api/optimizer/route.ts` — 20 lines, imports `getBestCard`. Minimal update.
- `src/app/optimizer/page.tsx` — 111 lines, shows result cards. Needs breakdown rows added.

Current `CardResult` type (line 16–22 of optimizer.ts):
```typescript
export type CardResult = {
  card: Card
  earn_rate: number
  earn_type: string
  category_matched: string
  notes: string | null
}
```

`other_categories` will be added to this type.

---

## Task 1: Rewrite `src/lib/optimizer.ts`

**Files:**
- Modify: `src/lib/optimizer.ts`

### Step 1: Replace the entire file content

```typescript
type Category = {
  category_name: string
  earn_rate: number
  earn_type: string
  notes: string | null
}

type Card = {
  id: string
  name: string
  reward_currency: string
  color?: string
  card_categories: Category[]
}

export type OtherCategory = {
  category_name: string
  earn_rate: number
  earn_type: string
}

export type CardResult = {
  card: Card
  earn_rate: number
  earn_type: string
  category_matched: string
  notes: string | null
  other_categories: OtherCategory[]
}

const MERCHANT_ALIASES: Record<string, string> = {
  // Rideshare
  uber: 'rideshare',
  lyft: 'rideshare',
  'uber eats': 'rideshare',
  // Flights
  delta: 'flights',
  united: 'flights',
  american: 'flights',
  southwest: 'flights',
  jetblue: 'flights',
  frontier: 'flights',
  'spirit airlines': 'flights',
  // Alaska Airlines
  alaska: 'alaska_airlines',
  'alaska airlines': 'alaska_airlines',
  'alaska air': 'alaska_airlines',
  // Prepaid Hotels
  marriott: 'prepaid_hotels',
  hilton: 'prepaid_hotels',
  hyatt: 'prepaid_hotels',
  ihg: 'prepaid_hotels',
  airbnb: 'prepaid_hotels',
  'four seasons': 'prepaid_hotels',
  // Grocery
  'whole foods': 'grocery',
  safeway: 'grocery',
  kroger: 'grocery',
  albertsons: 'grocery',
  "trader joe's": 'grocery',
  sprouts: 'grocery',
  costco: 'grocery',
  aldi: 'grocery',
  publix: 'grocery',
  // Gas
  chevron: 'gas',
  shell: 'gas',
  exxon: 'gas',
  mobil: 'gas',
  arco: 'gas',
  bp: 'gas',
  '76': 'gas',
  texaco: 'gas',
  // Transit
  amtrak: 'transit',
  bart: 'transit',
  muni: 'transit',
  metro: 'transit',
  caltrain: 'transit',
  // EV Charging
  tesla: 'ev_charging',
  'tesla supercharger': 'ev_charging',
  blink: 'ev_charging',
  chargepoint: 'ev_charging',
  electrify: 'ev_charging',
}

function resolveCategory(query: string, knownCategories: string[]): string {
  const normalized = query.toLowerCase().trim()

  // 1. Alias map (merchant names → category slug)
  if (MERCHANT_ALIASES[normalized]) {
    return MERCHANT_ALIASES[normalized]
  }

  // 2. Substring match against category slugs (spaces = underscores)
  const match = knownCategories.find((cat) => {
    if (cat === 'everything_else') return false
    const catReadable = cat.replace(/_/g, ' ')
    return catReadable.includes(normalized) || normalized.includes(catReadable)
  })
  if (match) return match

  return 'everything_else'
}

export function getCardResults(query: string, cards: Card[]): CardResult[] {
  const allCategories = [
    ...new Set(cards.flatMap((c) => c.card_categories.map((cc) => cc.category_name))),
  ]

  const resolved = resolveCategory(query, allCategories)

  const results: CardResult[] = cards.map((card) => {
    const matched =
      card.card_categories.find((c) => c.category_name === resolved) ??
      card.card_categories.find((c) => c.category_name === 'everything_else')

    const other_categories = card.card_categories
      .filter((c) => c.category_name !== matched?.category_name)
      .sort((a, b) => b.earn_rate - a.earn_rate)
      .slice(0, 4)
      .map((c) => ({
        category_name: c.category_name,
        earn_rate: c.earn_rate,
        earn_type: c.earn_type,
      }))

    return {
      card,
      earn_rate: matched?.earn_rate ?? 1,
      earn_type: matched?.earn_type ?? 'multiplier',
      category_matched: matched?.category_name ?? 'everything_else',
      notes: matched?.notes ?? null,
      other_categories,
    }
  })

  return results.sort((a, b) => b.earn_rate - a.earn_rate)
}

// Alias for backwards compatibility with any direct callers
export { getCardResults as getBestCard }
```

### Step 2: TypeScript check

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
```

Expected: clean (0 errors). The `getBestCard` alias export ensures the API import still works.

### Step 3: Commit

```bash
git add src/lib/optimizer.ts
git commit -m "feat: add merchant alias map + fuzzy category matching to optimizer"
```

---

## Task 2: Update `src/app/api/optimizer/route.ts`

**Files:**
- Modify: `src/app/api/optimizer/route.ts`

### Step 1: Update import + function call

Replace line 3 and line 18:

```typescript
// Before:
import { getBestCard } from '@/lib/optimizer'
// ...
const ranked = getBestCard(category, cards ?? [])

// After:
import { getCardResults } from '@/lib/optimizer'
// ...
const ranked = getCardResults(category, cards ?? [])
```

Full file after change:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCardResults } from '@/lib/optimizer'

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')
  if (!category) {
    return NextResponse.json({ error: 'category query param required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: cards, error } = await supabase
    .from('cards')
    .select('*, card_categories(*)')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ranked = getCardResults(category, cards ?? [])
  return NextResponse.json(ranked)
}
```

### Step 2: Commit

```bash
git add src/app/api/optimizer/route.ts
git commit -m "feat: use getCardResults in optimizer API"
```

---

## Task 3: Update `src/app/optimizer/page.tsx` — add breakdown display

**Files:**
- Modify: `src/app/optimizer/page.tsx`

The current result card (lines 82–106) shows name + matched category + earn badge. We need to add breakdown rows below.

### Step 1: Add `OtherCategory` to imports

Replace line 8:
```typescript
// Before:
import type { CardResult } from '@/lib/optimizer'
// After:
import type { CardResult, OtherCategory } from '@/lib/optimizer'
```

### Step 2: Add `formatOther` helper after `formatEarning` (after line 40, before `return`)

```typescript
  const formatOther = (oc: OtherCategory) => {
    if (oc.earn_type === 'multiplier') return `${oc.earn_rate}x`
    return `${oc.earn_rate}%`
  }
```

### Step 3: Replace the result card body (lines 83–106)

Replace:
```tsx
          {results.map((r, i) => (
            <Card
              key={r.card.id}
              className={i === 0 ? 'border-2 border-green-400 bg-green-50' : 'opacity-75'}
            >
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{r.card.name}</p>
                    {i === 0 && <Badge className="text-xs bg-green-600">Best</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    matched: {r.category_matched.replace(/_/g, ' ')}
                    {r.notes && ` · ${r.notes}`}
                  </p>
                </div>
                <Badge
                  variant={i === 0 ? 'default' : 'outline'}
                  className="text-sm shrink-0"
                >
                  {formatEarning(r)}
                </Badge>
              </CardContent>
            </Card>
          ))}
```

With:
```tsx
          {results.map((r, i) => (
            <Card
              key={r.card.id}
              className={i === 0 ? 'border-2 border-green-400 bg-green-50' : 'opacity-75'}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{r.card.name}</p>
                    {i === 0 && <Badge className="text-xs bg-green-600">Best</Badge>}
                  </div>
                  <Badge
                    variant={i === 0 ? 'default' : 'outline'}
                    className="text-sm shrink-0"
                  >
                    {formatEarning(r)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  matched: {r.category_matched.replace(/_/g, ' ')}
                  {r.notes && ` · ${r.notes}`}
                </p>
                {r.other_categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.other_categories.map((oc) => (
                      <span
                        key={oc.category_name}
                        className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
                      >
                        {oc.category_name.replace(/_/g, ' ')}: {formatOther(oc)}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
```

### Step 4: TypeScript check + build

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20
```

Expected: both clean.

### Step 5: Smoke test

```bash
npm run dev &
sleep 4
curl -s "http://localhost:3000/api/optimizer?category=uber" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('results:', len(d))
if d:
    r = d[0]
    print('best card:', r['card']['name'])
    print('matched:', r['category_matched'])
    print('other_categories count:', len(r.get('other_categories', [])))
"
pkill -f "next dev"
```

Expected: prints 3 results, best card matched to `rideshare`, other_categories count > 0.

### Step 6: Commit + push

```bash
git add src/app/optimizer/page.tsx
git commit -m "feat: show earn rate breakdown per card in optimizer results"
git pull --rebase origin master && git push origin master
```

---

## Done

The optimizer now:
- Accepts free-text input: merchant names ("Uber", "Whole Foods") or category keywords ("ride", "flight", "hotel")
- Resolves via static alias map first, then substring match against category slugs
- Shows matched rate prominently + up to 4 other category rates as pill badges on each result card
- Preset buttons still work exactly as before (exact slug → resolves immediately)
