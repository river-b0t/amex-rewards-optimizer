# Dashboard Overhaul + Offer Value Scoring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the bare home page with a command center (stat cards + expiring offers panel + benefits panel), and add a `% Return` column + sort to the offers table.

**Architecture:** New `GET /api/dashboard` server route handles all data fetching. Dashboard page becomes a thin server component. Expiring offers panel is a client island for inline enroll. Offers table gets a new computed column with no DB changes.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, Supabase JS v2, shadcn/ui, `src/lib/benefits.ts` for period helpers.

---

## Reference

Key files to understand before starting:
- `src/lib/benefits.ts` — `getPeriodKey`, `ResetPeriod` type
- `src/app/api/benefits/route.ts` — pattern for Supabase queries + period usage computation
- `src/app/api/offers/route.ts` — pattern for paginated Supabase fetches
- `src/components/offers/OfferCard.tsx` — full offers table (client component)
- `src/lib/supabase.ts` — `createServiceClient()` for server routes

---

## Task 1: Add `getPeriodEnd` to `src/lib/benefits.ts`

**Files:**
- Modify: `src/lib/benefits.ts`
- Test: `src/__tests__/lib/benefits.test.ts`

### Step 1: Write failing tests

Add to `src/__tests__/lib/benefits.test.ts`:

```typescript
import { getPeriodEnd } from '@/lib/benefits'

describe('getPeriodEnd', () => {
  it('monthly: returns last day of current month', () => {
    const date = new Date('2026-02-15T00:00:00Z')
    const end = getPeriodEnd('monthly', date)
    expect(end.toISOString().startsWith('2026-02-28')).toBe(true)
  })

  it('quarterly: returns last day of Q1 when in February', () => {
    const date = new Date('2026-02-15T00:00:00Z')
    const end = getPeriodEnd('quarterly', date)
    expect(end.toISOString().startsWith('2026-03-31')).toBe(true)
  })

  it('semi-annual: returns June 30 when in H1', () => {
    const date = new Date('2026-03-01T00:00:00Z')
    const end = getPeriodEnd('semi-annual', date)
    expect(end.toISOString().startsWith('2026-06-30')).toBe(true)
  })

  it('semi-annual: returns Dec 31 when in H2', () => {
    const date = new Date('2026-08-01T00:00:00Z')
    const end = getPeriodEnd('semi-annual', date)
    expect(end.toISOString().startsWith('2026-12-31')).toBe(true)
  })

  it('annual: returns Dec 31 of current year', () => {
    const date = new Date('2026-05-01T00:00:00Z')
    const end = getPeriodEnd('annual', date)
    expect(end.toISOString().startsWith('2026-12-31')).toBe(true)
  })
})
```

### Step 2: Run to confirm failures

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx jest benefits --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `getPeriodEnd is not a function`

### Step 3: Implement `getPeriodEnd`

Add to `src/lib/benefits.ts` after `getRemainingCents`:

```typescript
export function getPeriodEnd(resetPeriod: ResetPeriod, date: Date = new Date()): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() // 0-indexed

  switch (resetPeriod) {
    case 'monthly':
      // Day 0 of next month = last day of current month
      return new Date(Date.UTC(year, month + 1, 0))
    case 'quarterly': {
      // lastMonthOfQ: 3, 6, 9, or 12 (1-indexed). Day 0 of that+1 = last day of that month.
      const lastMonthOfQ = Math.ceil((month + 1) / 3) * 3
      return new Date(Date.UTC(year, lastMonthOfQ, 0))
    }
    case 'semi-annual': {
      const lastMonth = month < 6 ? 6 : 12
      return new Date(Date.UTC(year, lastMonth, 0))
    }
    case 'annual':
    case '4-year':
      return new Date(Date.UTC(year, 12, 0)) // Dec 31
  }
}
```

### Step 4: Run tests

```bash
npx jest benefits --no-coverage 2>&1 | tail -20
```

Expected: All `getPeriodEnd` tests PASS.

### Step 5: Commit

```bash
git add src/lib/benefits.ts src/__tests__/lib/benefits.test.ts
git commit -m "feat: add getPeriodEnd helper to benefits lib"
```

---

## Task 2: Create `GET /api/dashboard` route

**Files:**
- Create: `src/app/api/dashboard/route.ts`

### Step 1: Create the file

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getPeriodKey, getPeriodEnd } from '@/lib/benefits'
import type { ResetPeriod } from '@/lib/benefits'

export async function GET() {
  const supabase = createServiceClient()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const currentYear = now.getUTCFullYear().toString()

  // 1. Count enrolled offers
  const { count: enrolledOffersCount } = await supabase
    .from('enrolled_offers')
    .select('id', { count: 'exact', head: true })

  // 2. Get enrolled offer IDs (to exclude from expiring panel)
  const { data: enrolledRows } = await supabase
    .from('enrolled_offers')
    .select('offer_id')

  const enrolledIds = (enrolledRows ?? []).map((r) => r.offer_id as string)

  // 3. Get top 10 unenrolled offers expiring within 14 days, sorted by reward desc
  let expiringQuery = supabase
    .from('amex_offers')
    .select('id, merchant, reward_amount_cents, spend_min_cents, expiration_date, reward_type')
    .eq('active', true)
    .gte('expiration_date', today)
    .lte('expiration_date', in14)
    .order('reward_amount_cents', { ascending: false })
    .limit(20) // fetch extra to account for filtering

  const { data: rawExpiring } = await expiringQuery

  // Filter out already-enrolled on client side (Supabase "not in" is finicky with large arrays)
  const enrolledSet = new Set(enrolledIds)
  const expiringOffers = (rawExpiring ?? [])
    .filter((o) => !enrolledSet.has(o.id))
    .slice(0, 10)

  // 4. Count unenrolled offers expiring within 14 days (for stat card)
  const { count: expiringOffersCount } = await supabase
    .from('amex_offers')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)
    .gte('expiration_date', today)
    .lte('expiration_date', in14)

  // Subtract enrolled count from that to get unenrolled expiring count
  const unenrolledExpiringCount = Math.max(0, (expiringOffersCount ?? 0) - enrolledIds.filter((id) => {
    const offer = rawExpiring?.find((o) => o.id === id)
    return !!offer
  }).length)

  // 5. Get enrolled benefits with usage
  const { data: benefits } = await supabase
    .from('amex_benefits')
    .select('*, benefit_usage(*)')
    .eq('active', true)
    .eq('enrolled', true)
    .order('sort_order')

  // 6. Compute per-benefit: used_cents, remaining_cents, period_end
  const benefitsSummary = (benefits ?? []).map((b) => {
    const period = b.reset_period as ResetPeriod
    const periodKey = getPeriodKey(period, now)
    const periodEnd = getPeriodEnd(period, now)
    const periodUsage = (b.benefit_usage ?? []).filter(
      (u: { period_key: string }) => u.period_key === periodKey
    )
    const usedCents = periodUsage.reduce(
      (sum: number, u: { amount_used_cents: number }) => sum + u.amount_used_cents,
      0
    )
    const remainingCents = Math.max(0, b.amount_cents - usedCents)
    return {
      id: b.id as string,
      name: b.name as string,
      amount_cents: b.amount_cents as number,
      used_cents: usedCents,
      remaining_cents: remainingCents,
      reset_period: period,
      period_ends: periodEnd.toISOString().split('T')[0],
      category: b.category as string,
    }
  })

  // Sort by remaining cents desc
  benefitsSummary.sort((a, b) => b.remaining_cents - a.remaining_cents)

  // 7. Compute stat: total benefits remaining this period
  const benefitsRemainingCents = benefitsSummary.reduce((sum, b) => sum + b.remaining_cents, 0)

  // 8. Value captured YTD: benefit usage this year + completed enrolled offers
  const { data: ytdUsage } = await supabase
    .from('benefit_usage')
    .select('amount_used_cents')
    .like('period_key', `${currentYear}%`)

  const benefitYTDCents = (ytdUsage ?? []).reduce(
    (sum, u) => sum + (u.amount_used_cents as number), 0
  )

  const { data: completedOffers } = await supabase
    .from('enrolled_offers')
    .select('amex_offers(reward_amount_cents)')
    .eq('threshold_met', true)

  const offersYTDCents = (completedOffers ?? []).reduce((sum, row) => {
    const o = row.amex_offers as { reward_amount_cents: number } | null
    return sum + (o?.reward_amount_cents ?? 0)
  }, 0)

  const valueCapturedYTDCents = benefitYTDCents + offersYTDCents

  return NextResponse.json({
    stats: {
      enrolledOffersCount: enrolledOffersCount ?? 0,
      expiringOffersCount: unenrolledExpiringCount,
      benefitsRemainingCents,
      valueCapturedYTDCents,
    },
    expiringOffers,
    benefitsSummary,
  })
}
```

### Step 2: Manual smoke test

Start dev server and hit the endpoint:

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npm run dev &
sleep 3
curl -s http://localhost:3000/api/dashboard | python3 -m json.tool | head -60
```

Expected: JSON with `stats`, `expiringOffers` (array of up to 10), `benefitsSummary` (enrolled benefits only). No 500 errors.

Kill dev server after: `pkill -f "next dev"`

### Step 3: Commit

```bash
git add src/app/api/dashboard/route.ts
git commit -m "feat: add /api/dashboard data endpoint"
```

---

## Task 3: Create `StatCard` component

**Files:**
- Create: `src/components/dashboard/StatCard.tsx`

### Step 1: Create the component

```typescript
// src/components/dashboard/StatCard.tsx
export function StatCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string
  value: string
  subtext?: string
  accent?: 'green' | 'amber' | 'blue' | 'default'
}) {
  const accentColor = {
    green: 'border-l-green-500',
    amber: 'border-l-amber-500',
    blue: 'border-l-blue-500',
    default: 'border-l-gray-300',
  }[accent ?? 'default']

  return (
    <div className={`border border-gray-200 rounded-lg p-4 border-l-4 ${accentColor} bg-white`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.8px] text-gray-400">{label}</p>
      <p className="text-[24px] font-bold text-gray-900 mt-1 tabular-nums leading-none">{value}</p>
      {subtext && <p className="text-[12px] text-gray-400 mt-1">{subtext}</p>}
    </div>
  )
}
```

### Step 2: Commit

```bash
git add src/components/dashboard/StatCard.tsx
git commit -m "feat: add StatCard component"
```

---

## Task 4: Create `ExpiringOffersPanel` client component

**Files:**
- Create: `src/components/dashboard/ExpiringOffersPanel.tsx`

This is a client component because it manages enroll state.

### Step 1: Create the component

```typescript
// src/components/dashboard/ExpiringOffersPanel.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

type ExpiringOffer = {
  id: string
  merchant: string
  reward_amount_cents: number | null
  spend_min_cents: number | null
  expiration_date: string | null
  reward_type: string
}

function formatReward(offer: ExpiringOffer): string {
  if (!offer.reward_amount_cents) return '—'
  if (offer.reward_type === 'points') {
    return offer.reward_amount_cents.toLocaleString() + ' pts'
  }
  const d = offer.reward_amount_cents / 100
  return `$${d % 1 === 0 ? d.toFixed(0) : d.toFixed(2)}`
}

function formatReturn(offer: ExpiringOffer): string {
  if (
    offer.reward_type === 'points' ||
    !offer.spend_min_cents ||
    !offer.reward_amount_cents ||
    offer.spend_min_cents === 0
  ) return '—'
  const pct = (offer.reward_amount_cents / offer.spend_min_cents) * 100
  return `${Math.round(pct)}%`
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function EnrollButton({ offer }: { offer: ExpiringOffer }) {
  const [enrolled, setEnrolled] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleEnroll() {
    setLoading(true)
    const res = await fetch('/api/offers/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: offer.id }),
    })
    const data = await res.json()
    setEnrolled(data.enrolled)
    setLoading(false)
  }

  if (enrolled) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-[6px] h-[6px] rounded-full bg-green-500 shrink-0" />
        <span className="text-[11px] text-green-700 font-semibold">Enrolled</span>
      </div>
    )
  }

  return (
    <button
      onClick={handleEnroll}
      disabled={loading}
      className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-30 transition-colors"
    >
      {loading ? '…' : 'Enroll'}
    </button>
  )
}

export function ExpiringOffersPanel({ offers }: { offers: ExpiringOffer[] }) {
  if (offers.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-[14px] font-semibold text-gray-900 mb-4">Expiring Offers</h2>
        <p className="text-[13px] text-gray-400">No unenrolled offers expiring in the next 14 days.</p>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-[#fafafa]">
        <h2 className="text-[14px] font-semibold text-gray-900">Expiring Offers</h2>
        <span className="text-[11px] text-gray-400">Next 14 days · top {offers.length} by value</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_60px_80px_80px] px-4 py-2 border-b border-gray-100 bg-[#fafafa]">
        {(['Merchant', 'Reward', '% Ret', 'Expires', ''].map((h, i) => (
          <div key={i} className={`text-[10px] font-medium uppercase tracking-[0.8px] text-gray-400 ${i > 0 ? 'text-right' : ''}`}>
            {h}
          </div>
        )))}
      </div>

      {/* Rows */}
      {offers.map((offer) => {
        const days = offer.expiration_date ? daysUntil(offer.expiration_date) : null
        return (
          <div
            key={offer.id}
            className="grid grid-cols-[1fr_80px_60px_80px_80px] items-center px-4 h-[44px] border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors"
          >
            <p className="text-[13px] font-semibold text-gray-900 truncate">{offer.merchant}</p>
            <p className="text-[13px] font-bold text-green-700 tabular-nums text-right">{formatReward(offer)}</p>
            <p className="text-[12px] text-gray-500 tabular-nums text-right">{formatReturn(offer)}</p>
            <p className={`text-[12px] tabular-nums text-right ${days !== null && days <= 7 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
              {days !== null ? `${days}d` : '—'}
            </p>
            <div className="flex justify-end">
              <EnrollButton offer={offer} />
            </div>
          </div>
        )
      })}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-[#fafafa]">
        <Link href="/offers" className="text-[12px] text-blue-600 hover:text-blue-800 font-medium">
          View all offers →
        </Link>
      </div>
    </div>
  )
}
```

### Step 2: Commit

```bash
git add src/components/dashboard/ExpiringOffersPanel.tsx
git commit -m "feat: add ExpiringOffersPanel client component"
```

---

## Task 5: Create `BenefitsSummaryPanel` server component

**Files:**
- Create: `src/components/dashboard/BenefitsSummaryPanel.tsx`

### Step 1: Create the component

```typescript
// src/components/dashboard/BenefitsSummaryPanel.tsx
import Link from 'next/link'

type BenefitSummary = {
  id: string
  name: string
  amount_cents: number
  used_cents: number
  remaining_cents: number
  reset_period: string
  period_ends: string
  category: string
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`
}

const CATEGORY_COLORS: Record<string, string> = {
  travel: 'bg-blue-100 text-blue-700',
  dining: 'bg-orange-100 text-orange-700',
  shopping: 'bg-purple-100 text-purple-700',
  wellness: 'bg-green-100 text-green-700',
  entertainment: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
}

export function BenefitsSummaryPanel({ benefits }: { benefits: BenefitSummary[] }) {
  if (benefits.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-[14px] font-semibold text-gray-900 mb-4">Benefits This Period</h2>
        <p className="text-[13px] text-gray-400">No enrolled benefits. Go to Benefits to enroll.</p>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-[#fafafa]">
        <h2 className="text-[14px] font-semibold text-gray-900">Benefits This Period</h2>
        <span className="text-[11px] text-gray-400">Enrolled only</span>
      </div>

      {/* Rows */}
      {benefits.map((b) => {
        const pct = b.amount_cents > 0 ? Math.min(100, Math.round((b.used_cents / b.amount_cents) * 100)) : 0
        const daysLeft = daysUntil(b.period_ends)
        const catColor = CATEGORY_COLORS[b.category] ?? CATEGORY_COLORS.other
        const isFullyUsed = b.remaining_cents === 0

        return (
          <div key={b.id} className="px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/40 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${catColor}`}>
                  {b.category}
                </span>
                <p className="text-[13px] font-semibold text-gray-900 truncate">{b.name}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className={`text-[13px] font-bold tabular-nums ${isFullyUsed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {formatDollars(b.remaining_cents)}
                </span>
                <span className="text-[11px] text-gray-400"> left</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all ${isFullyUsed ? 'bg-gray-300' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400">{pct}% used</span>
              <span className={`text-[11px] ${daysLeft <= 7 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                {daysLeft}d left in period
              </span>
            </div>
          </div>
        )
      })}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-[#fafafa]">
        <Link href="/benefits" className="text-[12px] text-blue-600 hover:text-blue-800 font-medium">
          Manage benefits →
        </Link>
      </div>
    </div>
  )
}
```

### Step 2: Commit

```bash
git add src/components/dashboard/BenefitsSummaryPanel.tsx
git commit -m "feat: add BenefitsSummaryPanel component"
```

---

## Task 6: Rewrite `src/app/page.tsx` dashboard

**Files:**
- Modify: `src/app/page.tsx`

### Step 1: Rewrite the file

```typescript
// src/app/page.tsx
import { StatCard } from '@/components/dashboard/StatCard'
import { ExpiringOffersPanel } from '@/components/dashboard/ExpiringOffersPanel'
import { BenefitsSummaryPanel } from '@/components/dashboard/BenefitsSummaryPanel'

async function getDashboardData() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/dashboard`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch dashboard data')
  return res.json()
}

function formatDollars(cents: number): string {
  if (cents >= 100000) return `$${(cents / 100000).toFixed(1)}k`
  return `$${Math.round(cents / 100).toLocaleString()}`
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const { stats, expiringOffers, benefitsSummary } = data

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Amex Platinum — rewards at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Enrolled Offers"
          value={stats.enrolledOffersCount.toString()}
          accent="blue"
        />
        <StatCard
          label="Expiring in 14d"
          value={stats.expiringOffersCount.toString()}
          subtext="unenrolled"
          accent={stats.expiringOffersCount > 0 ? 'amber' : 'default'}
        />
        <StatCard
          label="Benefits Remaining"
          value={formatDollars(stats.benefitsRemainingCents)}
          subtext="this period"
          accent="green"
        />
        <StatCard
          label="Value Captured YTD"
          value={formatDollars(stats.valueCapturedYTDCents)}
          accent="default"
        />
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExpiringOffersPanel offers={expiringOffers} />
        <BenefitsSummaryPanel benefits={benefitsSummary} />
      </div>
    </div>
  )
}
```

### Step 2: Visual verification

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- 4 stat cards render with real numbers
- Expiring offers panel shows up to 10 rows with Merchant, Reward, % Ret, days, Enroll button
- Benefits panel shows enrolled benefits with progress bars and days left
- Enroll button on an offer works (green dot appears, no page reload)

### Step 3: Commit

```bash
git add src/app/page.tsx
git commit -m "feat: dashboard overhaul with stat cards, expiring offers, and benefits panels"
```

---

## Task 7: Add `% Return` column and sort to offers table

**Files:**
- Modify: `src/components/offers/OfferCard.tsx`

### Step 1: Understand current state

`OfferCard.tsx` has:
- `type SortKey = 'reward' | 'expiry' | 'merchant'`
- `const GRID = 'grid grid-cols-[minmax(160px,1fr)_80px_100px_90px_110px_80px_100px]'` (7 cols)
- Column order: Merchant | Category | Reward | MinSpend | Expires | Status | Action

### Step 2: Apply changes to `OfferCard.tsx`

**Change 1:** Update `SortKey` type (line 16):
```typescript
// Before:
type SortKey = 'reward' | 'expiry' | 'merchant'
// After:
type SortKey = 'reward' | 'expiry' | 'merchant' | 'return'
```

**Change 2:** Update `GRID` constant (line 82) — add 70px column after the 90px MinSpend:
```typescript
// Before:
const GRID = 'grid grid-cols-[minmax(160px,1fr)_80px_100px_90px_110px_80px_100px]'
// After:
const GRID = 'grid grid-cols-[minmax(160px,1fr)_80px_100px_90px_70px_110px_80px_100px]'
```

**Change 3:** Add `computeReturn` helper after `formatMinSpend` (after line 50):
```typescript
function computeReturn(offer: Offer): number | null {
  if (
    offer.reward_type === 'points' ||
    !offer.spend_min_cents ||
    !offer.reward_amount_cents ||
    offer.spend_min_cents === 0
  ) return null
  return Math.round((offer.reward_amount_cents / offer.spend_min_cents) * 100)
}
```

**Change 4:** In `OfferRow`, add `% Return` cell after the MinSpend cell (after the `{/* Min spend */}` block, before `{/* Expires */}`):
```typescript
{/* % Return */}
<div className="px-2 text-right">
  {(() => {
    const pct = computeReturn(offer)
    return pct !== null ? (
      <span className="font-[var(--font-geist-mono)] text-[13px] text-purple-700 font-semibold tabular-nums">
        {pct}%
      </span>
    ) : (
      <span className="font-[var(--font-geist-mono)] text-[13px] text-gray-300 tabular-nums">—</span>
    )
  })()}
</div>
```

**Change 5:** Add `% Return` column header in the headers section, after `Min Spend` and before `Expires`:
```typescript
// After: <ColHeader align="right">Min Spend</ColHeader>
<ColHeader align="right">% Return</ColHeader>
// Before: <ColHeader>Expires</ColHeader>
```

**Change 6:** Add `% Return` sort pill after `Merchant A–Z` pill:
```typescript
// After existing SortPill for merchant:
<SortPill active={sortBy === 'return'} onClick={() => setSortBy('return')}>% Return ↓</SortPill>
```

**Change 7:** Update the `sorted` useMemo to handle `'return'` sort (after the `merchant` case):
```typescript
// In the sort function:
if (sortBy === 'return') {
  const aRet = computeReturn(a) ?? -1
  const bRet = computeReturn(b) ?? -1
  return bRet - aRet
}
```

### Step 3: Visual verification

With dev server running, open http://localhost:3000/offers. Verify:
- 8 columns in table (Merchant, Category, Reward, Min Spend, % Return, Expires, Status, Action)
- `% Return` shows integer percentages for cash offers with min spend, `—` for points or no-min-spend
- Clicking `% Return ↓` sort pill re-orders the table with highest % first
- Offers with `—` sort to the bottom when using % Return sort

### Step 4: Commit

```bash
git add src/components/offers/OfferCard.tsx
git commit -m "feat: add % Return column and sort to offers table"
```

---

## Task 8: Build check + push

### Step 1: Run build

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npm run build 2>&1 | tail -30
```

Expected: Compiled successfully, no TypeScript errors.

If build fails, read the error, fix it, and re-run.

### Step 2: Push to GitHub

```bash
git push origin master
```

### Step 3: Verify Vercel deployment

After push, check https://vercel.com/river-b0t/amex-rewards-optimizer for the deployment. Once complete, open https://amex-rewards-optimizer.vercel.app and verify the dashboard and offers table in production.

---

## Done

The implementation delivers:
- Dashboard: 4 stat cards + expiring offers panel (inline enroll) + benefits this period panel
- Offers: `% Return` column + sort pill, computed client-side, no DB changes
