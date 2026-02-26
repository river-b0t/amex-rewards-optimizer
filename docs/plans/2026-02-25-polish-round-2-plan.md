# Polish Round 2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Style the login page, add a manual sync button to the offers table, and add Escape-to-cancel on the partial usage input.

**Architecture:** Four independent file changes — login page is a full rewrite of a single client component; sync-now is a new API route with identical logic to the existing cron route but no Bearer check; manual sync button adds state + handler + button to OffersTable; Escape fix is a one-liner in BenefitCard.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui (not used on login — native HTML for simplicity). No test suite — verify with `npx tsc --noEmit` + `npm run build`.

---

## Reference

Key files:
- `src/app/login/page.tsx` — 36 lines, bare unstyled form. Full replacement.
- `src/app/api/offers/sync/route.ts` — requires `Authorization: Bearer <CRON_SECRET>`. The new `sync-now` route duplicates its scrape+upsert logic but skips the Bearer check (middleware handles auth instead).
- `src/components/offers/OfferCard.tsx` — client component, `OffersTable` already has `lastSyncedAt` prop and `formatRelativeTime` helper. Uses `useState`, `useMemo`, `useCallback` — needs `useRouter` added.
- `src/components/benefits/BenefitCard.tsx` — partial usage input has `onKeyDown` handling `Enter`. Needs `Escape` added.

---

## Task 1: Style the login page

**Files:**
- Modify: `src/app/login/page.tsx`

### Step 1: Replace the entire file

```typescript
'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      window.location.href = '/'
    } else {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Amex Optimizer</h1>
          <p className="text-sm text-gray-500 mt-1">Track benefits, enrolled offers, and maximize rewards.</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 transition-colors"
                placeholder="Enter password"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">Incorrect password. Try again.</p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-gray-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
            >
              {loading ? 'Checking...' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

### Step 2: TypeScript check

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

### Step 3: Commit

```bash
git add src/app/login/page.tsx
git commit -m "feat: style login page"
```

---

## Task 2: Create `POST /api/offers/sync-now` route

**Files:**
- Create: `src/app/api/offers/sync-now/route.ts`

This is the same scrape+upsert logic as `src/app/api/offers/sync/route.ts` but with no Bearer token check — the middleware cookie auth already protects it.

### Step 1: Create the route

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { scrapeFrequentMilerOffers } from '@/lib/scraper'

export async function POST() {
  try {
    const offers = await scrapeFrequentMilerOffers()

    if (offers.length === 0) {
      return NextResponse.json(
        { synced: 0, message: 'No offers scraped', timestamp: new Date().toISOString() },
        { status: 200 }
      )
    }

    const supabase = createServiceClient()

    const { error: upsertError } = await supabase.from('amex_offers').upsert(
      offers.map((o) => ({
        ...o,
        active: true,
        scraped_at: new Date().toISOString(),
      })),
      {
        onConflict: 'merchant,expiration_date,reward_amount_cents',
        ignoreDuplicates: false,
      }
    )

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('amex_offers')
      .update({ active: false })
      .lt('expiration_date', today)

    return NextResponse.json({
      synced: offers.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[sync-now] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

### Step 2: TypeScript check

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

### Step 3: Commit

```bash
git add src/app/api/offers/sync-now/route.ts
git commit -m "feat: add POST /api/offers/sync-now for cookie-auth manual sync"
```

---

## Task 3: Add manual sync button to OffersTable

**Files:**
- Modify: `src/components/offers/OfferCard.tsx`

### Step 1: Add `useRouter` to imports

Find the current import line (line 3):
```typescript
import { useState, useMemo, useCallback } from 'react'
```

Replace with:
```typescript
import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
```

### Step 2: Add `syncing` state and `handleSync` inside `OffersTable`

After the existing state declarations (after `const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)`), add:

```typescript
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    await fetch('/api/offers/sync-now', { method: 'POST' })
    router.refresh()
    setSyncing(false)
  }
```

### Step 3: Add sync button to the header

Find the header section (the `{/* ── Header ── */}` block). Currently it ends with just the title/subtitle div. Replace the header with:

```tsx
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">Amex Offers</h1>
          <span className="text-[13px] text-gray-400">
            {offers.length.toLocaleString()} offers · {enrolledCount} enrolled
            {lastSyncedAt && ` · synced ${formatRelativeTime(lastSyncedAt)}`}
          </span>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-[12px] font-medium border border-gray-200 rounded px-3 py-1.5 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
```

### Step 4: TypeScript check

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

### Step 5: Commit

```bash
git add src/components/offers/OfferCard.tsx
git commit -m "feat: add manual sync button to offers table"
```

---

## Task 4: Escape to cancel partial usage input + build + push

**Files:**
- Modify: `src/components/benefits/BenefitCard.tsx`

### Step 1: Update the `onKeyDown` handler on the partial input

Find the current `onKeyDown` on the partial usage input:

```tsx
                        onKeyDown={(e) => e.key === 'Enter' && logPartialUsage()}
```

Replace with:

```tsx
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') logPartialUsage()
                          if (e.key === 'Escape') { setShowPartial(false); setPartialInput('') }
                        }}
```

### Step 2: TypeScript check + build

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20
```

Expected: both clean.

### Step 3: Commit + push

```bash
git add src/components/benefits/BenefitCard.tsx
git commit -m "fix: Escape key cancels partial usage input"
git pull --rebase origin master && git push origin master
```

---

## Done

- Login page: centered card with app name, password field, loading state, inline error
- Manual sync: `POST /api/offers/sync-now` (cookie-auth), button in offers header, refreshes on success
- Escape to cancel: partial usage input dismisses cleanly on Escape
