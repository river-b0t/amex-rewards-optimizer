# UX Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add logout, remove two dead filter/sort buttons, and add partial usage logging to benefit cards.

**Architecture:** Three independent tasks — logout is a new API route + nav client island; offers cleanup is a two-line deletion; benefits partial usage is a new inline input state added to BenefitCard. No DB migrations needed.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui. No test suite — verify with `npx tsc --noEmit` + `npm run build`.

---

## Reference

Auth is cookie-based: `site-auth` cookie set by `POST /api/login` (value = `SITE_PASSWORD` env var). Middleware at `src/middleware.ts` checks the cookie on all non-API routes. No logout route exists.

Nav is a plain server component (`src/components/nav.tsx`, 15 lines). Logout button must be a separate client component imported into the nav.

BenefitCard (`src/components/benefits/BenefitCard.tsx`, 160 lines) already calls `POST /api/benefits/usage` with `{ benefit_id, amount_used_cents }`. The API accepts any amount.

---

## Task 1: Add `POST /api/logout` route

**Files:**
- Create: `src/app/api/logout/route.ts`

### Step 1: Create the route

```typescript
import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('site-auth', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
  })
  return response
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
git add src/app/api/logout/route.ts
git commit -m "feat: add POST /api/logout route"
```

---

## Task 2: Add `LogoutButton` client component + wire into nav

**Files:**
- Create: `src/components/logout-button.tsx`
- Modify: `src/components/nav.tsx`

### Step 1: Create the LogoutButton component

```typescript
// src/components/logout-button.tsx
'use client'

export function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Log out
    </button>
  )
}
```

### Step 2: Add LogoutButton to nav

Replace the entire content of `src/components/nav.tsx`:

```typescript
import Link from 'next/link'
import { LogoutButton } from '@/components/logout-button'

export function Nav() {
  return (
    <nav className="border-b bg-white sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-sm tracking-tight">Amex Optimizer</span>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
        <Link href="/benefits" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Benefits</Link>
        <Link href="/optimizer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Optimizer</Link>
        <Link href="/offers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Offers</Link>
        <LogoutButton />
      </div>
    </nav>
  )
}
```

### Step 3: TypeScript check

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

### Step 4: Smoke test

```bash
npm run dev &
sleep 4
curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt -X POST http://localhost:3000/api/logout | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok:', d.get('ok'))"
pkill -f "next dev"
```

Expected: `ok: True`

### Step 5: Commit

```bash
git add src/components/logout-button.tsx src/components/nav.tsx
git commit -m "feat: add logout button to nav"
```

---

## Task 3: Remove dead Sort/Filter header buttons from OffersTable

**Files:**
- Modify: `src/components/offers/OfferCard.tsx`

### Step 1: Remove the two dead buttons

In `src/components/offers/OfferCard.tsx`, find and delete this block (currently around lines 340–348):

```tsx
        <div className="flex gap-2">
          <button className="text-[12px] font-medium border border-gray-200 rounded px-3 py-1.5 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors">
            Sort
          </button>
          <button className="text-[12px] font-medium border border-gray-200 rounded px-3 py-1.5 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors">
            Filter
          </button>
        </div>
```

The header `div` around it (the flex row with title + those buttons) should shrink to just:

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
      </div>
```

### Step 2: TypeScript check

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

### Step 3: Commit

```bash
git add src/components/offers/OfferCard.tsx
git commit -m "chore: remove dead Sort/Filter header buttons from offers table"
```

---

## Task 4: Add partial usage input to BenefitCard

**Files:**
- Modify: `src/components/benefits/BenefitCard.tsx`

### Step 1: Add partial usage state + handler

In `BenefitCard`, after the existing state declarations (after line 41 `const [enrollLoading, setEnrollLoading] = useState(false)`), add:

```typescript
  const [showPartial, setShowPartial] = useState(false)
  const [partialInput, setPartialInput] = useState('')
  const [partialLoading, setPartialLoading] = useState(false)
```

After the existing `markFullyUsed` function, add:

```typescript
  async function logPartialUsage() {
    const dollars = parseFloat(partialInput)
    if (!dollars || dollars <= 0) return
    const cents = Math.min(Math.round(dollars * 100), benefit.remaining_cents)
    setPartialLoading(true)
    await fetch('/api/benefits/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benefit_id: benefit.id, amount_used_cents: cents }),
    })
    setUsedCents((prev) => Math.min(prev + cents, initial.amount_cents))
    setPartialInput('')
    setShowPartial(false)
    setPartialLoading(false)
  }
```

### Step 2: Add partial usage UI to the button area

The current button area for enrolled + not fully used (inside the `<>` block, starting around line 132) is:

```tsx
              {enrolled && !isFullyUsed && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={markFullyUsed}
                  disabled={usageLoading}
                >
                  {usageLoading ? 'Saving...' : 'Mark fully used'}
                </Button>
              )}
              {enrolled && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground"
                  onClick={toggleEnrolled}
                  disabled={enrollLoading}
                >
                  {enrollLoading ? '...' : 'Unenroll'}
                </Button>
              )}
```

Replace with:

```tsx
              {enrolled && !isFullyUsed && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={markFullyUsed}
                    disabled={usageLoading}
                  >
                    {usageLoading ? 'Saving...' : 'Mark fully used'}
                  </Button>
                  {!showPartial ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={() => setShowPartial(true)}
                    >
                      Log partial
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="1"
                        max={Math.floor(benefit.remaining_cents / 100)}
                        value={partialInput}
                        onChange={(e) => setPartialInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && logPartialUsage()}
                        className="w-16 text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-gray-400"
                        placeholder="0"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={logPartialUsage}
                        disabled={partialLoading || !partialInput}
                      >
                        {partialLoading ? '...' : 'Log'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground"
                        onClick={() => { setShowPartial(false); setPartialInput('') }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </>
              )}
              {enrolled && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground"
                  onClick={toggleEnrolled}
                  disabled={enrollLoading}
                >
                  {enrollLoading ? '...' : 'Unenroll'}
                </Button>
              )}
```

### Step 3: TypeScript check + build

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20
```

Expected: both clean.

### Step 4: Commit + push

```bash
git add src/components/benefits/BenefitCard.tsx
git commit -m "feat: add partial usage logging to benefit cards"
git pull --rebase origin master && git push origin master
```

---

## Done

- Logout button in nav clears `site-auth` cookie and redirects to `/login`
- Dead Sort/Filter header buttons removed from offers table (real controls in toolbar below are unchanged)
- Benefit cards now show "Log partial" → inline `$___` input → caps at remaining amount
