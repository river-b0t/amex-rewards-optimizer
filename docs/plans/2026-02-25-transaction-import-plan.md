# Transaction Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upload Amex CSV transaction history to auto-detect benefit fulfillments and enrolled-offer threshold completions, with a preview-then-confirm UI at `/import`.

**Architecture:** Five tasks in dependency order — extend csv-parser.ts first (shared lib), then two API routes (parse = preview, import = commit), then the `/import` page UI, then the nav link. No test suite — verify each task with `npx tsc --noEmit`.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, Supabase JS v2 (`createServiceClient()`). No tests — TypeScript check + manual smoke test.

---

## Reference

Key existing files:
- `src/lib/csv-parser.ts` — `parseAmexCSV()`, `matchToBenefit()`, `ParsedTransaction` type. Positive amounts = purchases (is_credit naming is misleading but correct).
- `src/lib/benefits.ts` — `getPeriodKey(resetPeriod, date)`, `ResetPeriod` type.
- `src/app/api/benefits/csv-import/route.ts` — existing import logic (reference only, leave it in place).
- `src/components/nav.tsx` — add Import link here.
- Supabase tables: `benefit_usage(id, benefit_id, amount_used_cents, period_key, notes, source)`, `enrolled_offers(id, offer_id, spent_amount_cents, threshold_met, completed_at)`, `amex_offers(id, merchant, spend_min_cents)`, `amex_benefits(id, name, reset_period)`.

---

## Task 1: Extend csv-parser.ts — add `parseAmexDate`, offer types, and `matchToOffers()`

**Files:**
- Modify: `src/lib/csv-parser.ts`

### Step 1: Add `parseAmexDate` export

The function exists privately in `src/app/api/benefits/csv-import/route.ts`. Add an exported version to csv-parser.ts so both API routes can share it.

After the closing brace of `matchToBenefit` (line 58), append:

```typescript
export function parseAmexDate(dateStr: string): Date {
  // Amex CSV date format: MM/DD/YYYY
  const [m, d, y] = dateStr.split('/')
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
}
```

### Step 2: Add offer matching types

After `parseAmexDate`, append:

```typescript
export type EnrolledOfferInput = {
  enrollment_id: string
  offer_id: string
  merchant: string
  spend_min_cents: number | null
}

export type OfferMatchResult = {
  enrollment_id: string
  offer_id: string
  merchant: string
  total_spent_cents: number
  spend_min_cents: number
}
```

### Step 3: Add `normalizeMerchant` helper and `matchToOffers`

After the types, append:

```typescript
function normalizeMerchant(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function matchToOffers(
  transactions: ParsedTransaction[],
  offers: EnrolledOfferInput[]
): OfferMatchResult[] {
  const results: OfferMatchResult[] = []

  for (const offer of offers) {
    if (offer.spend_min_cents === null || !offer.merchant) continue

    const normalizedMerchant = normalizeMerchant(offer.merchant)
    if (!normalizedMerchant) continue

    const matching = transactions.filter(
      (t) => t.is_credit && normalizeMerchant(t.description).includes(normalizedMerchant)
    )
    const totalCents = Math.round(matching.reduce((sum, t) => sum + t.amount, 0) * 100)

    if (totalCents >= offer.spend_min_cents) {
      results.push({
        enrollment_id: offer.enrollment_id,
        offer_id: offer.offer_id,
        merchant: offer.merchant,
        total_spent_cents: totalCents,
        spend_min_cents: offer.spend_min_cents,
      })
    }
  }

  return results
}
```

### Step 4: TypeScript check

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

### Step 5: Commit

```bash
git add src/lib/csv-parser.ts
git commit -m "feat: add parseAmexDate, matchToOffers to csv-parser"
```

---

## Task 2: Create `POST /api/transactions/parse` — preview endpoint (no DB writes)

**Files:**
- Create: `src/app/api/transactions/parse/route.ts`

This endpoint parses the CSV, runs both matchers, checks for duplicates in the DB, and returns a preview. It does NOT write anything.

### Step 1: Create the directory and route file

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseAmexCSV, matchToBenefit, matchToOffers, parseAmexDate, OfferMatchResult } from '@/lib/csv-parser'
import { getPeriodKey, ResetPeriod } from '@/lib/benefits'

type BenefitMatchResult = {
  benefit_id: string
  benefit_name: string
  amount_cents: number
  date: string
  notes: string
  period_key: string
  duplicate: boolean
}

export async function POST(req: NextRequest) {
  const { csv } = await req.json()
  if (!csv) return NextResponse.json({ error: 'csv required' }, { status: 400 })

  const transactions = parseAmexCSV(csv)
  const supabase = createServiceClient()

  // ── Benefits matching ──────────────────────────────────────────────
  const { data: benefits } = await supabase
    .from('amex_benefits')
    .select('id, name, reset_period')
    .eq('active', true)

  const benefitMatches: BenefitMatchResult[] = []

  for (const txn of transactions.filter((t) => t.is_credit)) {
    const benefitName = matchToBenefit(txn.description, txn.amount)
    if (!benefitName) continue
    const benefit = benefits?.find((b) => b.name === benefitName)
    if (!benefit) continue

    const txnDate = parseAmexDate(txn.date)
    const periodKey = getPeriodKey(benefit.reset_period as ResetPeriod, txnDate)
    const notes = txn.description
    const amount_cents = Math.round(txn.amount * 100)

    // Dedup: check if this exact usage record already exists
    const { data: existing } = await supabase
      .from('benefit_usage')
      .select('id')
      .eq('benefit_id', benefit.id)
      .eq('period_key', periodKey)
      .eq('notes', notes)
      .maybeSingle()

    benefitMatches.push({
      benefit_id: benefit.id,
      benefit_name: benefitName,
      amount_cents,
      date: txn.date,
      notes,
      period_key: periodKey,
      duplicate: !!existing,
    })
  }

  // ── Offers matching ───────────────────────────────────────────────
  const { data: enrolledOffers } = await supabase
    .from('enrolled_offers')
    .select('id, offer_id, amex_offers(merchant, spend_min_cents)')
    .eq('threshold_met', false)

  const offerInputs = (enrolledOffers ?? []).map((e) => ({
    enrollment_id: e.id as string,
    offer_id: e.offer_id as string,
    merchant: (e.amex_offers as { merchant: string; spend_min_cents: number | null } | null)?.merchant ?? '',
    spend_min_cents: (e.amex_offers as { merchant: string; spend_min_cents: number | null } | null)?.spend_min_cents ?? null,
  }))

  const offerMatches: OfferMatchResult[] = matchToOffers(transactions, offerInputs)

  return NextResponse.json({
    transaction_count: transactions.length,
    benefit_matches: benefitMatches,
    offer_matches: offerMatches,
  })
}
```

### Step 2: TypeScript check

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors. If there are type errors on the Supabase join cast, widen the cast to `unknown` then narrow: `(e.amex_offers as unknown as { merchant: string; spend_min_cents: number | null } | null)`.

### Step 3: Commit

```bash
git add src/app/api/transactions/parse/route.ts
git commit -m "feat: add POST /api/transactions/parse preview endpoint"
```

---

## Task 3: Create `POST /api/transactions/import` — commit endpoint

**Files:**
- Create: `src/app/api/transactions/import/route.ts`

Same logic as parse, but writes to the DB: inserts non-duplicate benefit_usage records and updates enrolled_offers where threshold is met.

### Step 1: Create the route file

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseAmexCSV, matchToBenefit, matchToOffers, parseAmexDate } from '@/lib/csv-parser'
import { getPeriodKey, ResetPeriod } from '@/lib/benefits'

export async function POST(req: NextRequest) {
  const { csv } = await req.json()
  if (!csv) return NextResponse.json({ error: 'csv required' }, { status: 400 })

  const transactions = parseAmexCSV(csv)
  const supabase = createServiceClient()

  // ── Benefits ──────────────────────────────────────────────────────
  const { data: benefits } = await supabase
    .from('amex_benefits')
    .select('id, name, reset_period')
    .eq('active', true)

  let benefitsImported = 0
  let benefitsSkipped = 0

  for (const txn of transactions.filter((t) => t.is_credit)) {
    const benefitName = matchToBenefit(txn.description, txn.amount)
    if (!benefitName) continue
    const benefit = benefits?.find((b) => b.name === benefitName)
    if (!benefit) continue

    const txnDate = parseAmexDate(txn.date)
    const periodKey = getPeriodKey(benefit.reset_period as ResetPeriod, txnDate)
    const notes = txn.description

    // Dedup check
    const { data: existing } = await supabase
      .from('benefit_usage')
      .select('id')
      .eq('benefit_id', benefit.id)
      .eq('period_key', periodKey)
      .eq('notes', notes)
      .maybeSingle()

    if (existing) {
      benefitsSkipped++
      continue
    }

    const { error } = await supabase.from('benefit_usage').insert({
      benefit_id: benefit.id,
      amount_used_cents: Math.round(txn.amount * 100),
      period_key: periodKey,
      notes,
      source: 'csv',
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    benefitsImported++
  }

  // ── Offers ────────────────────────────────────────────────────────
  const { data: enrolledOffers } = await supabase
    .from('enrolled_offers')
    .select('id, offer_id, amex_offers(merchant, spend_min_cents)')
    .eq('threshold_met', false)

  const offerInputs = (enrolledOffers ?? []).map((e) => ({
    enrollment_id: e.id as string,
    offer_id: e.offer_id as string,
    merchant: (e.amex_offers as { merchant: string; spend_min_cents: number | null } | null)?.merchant ?? '',
    spend_min_cents: (e.amex_offers as { merchant: string; spend_min_cents: number | null } | null)?.spend_min_cents ?? null,
  }))

  const offerMatches = matchToOffers(transactions, offerInputs)
  let offersUpdated = 0

  for (const match of offerMatches) {
    const { error } = await supabase
      .from('enrolled_offers')
      .update({
        threshold_met: true,
        completed_at: new Date().toISOString(),
        spent_amount_cents: match.total_spent_cents,
      })
      .eq('id', match.enrollment_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    offersUpdated++
  }

  return NextResponse.json({
    benefits_imported: benefitsImported,
    benefits_skipped: benefitsSkipped,
    offers_updated: offersUpdated,
  })
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
git add src/app/api/transactions/import/route.ts
git commit -m "feat: add POST /api/transactions/import commit endpoint"
```

---

## Task 4: Create `/import` page

**Files:**
- Create: `src/app/import/page.tsx`

A single client component. States: `idle` → `parsing` → `preview` → `importing` → `done` (or `error` from any async step).

### Step 1: Create the file

```typescript
'use client'

import { useState, useRef } from 'react'
import { Nav } from '@/components/nav'

type BenefitMatch = {
  benefit_id: string
  benefit_name: string
  amount_cents: number
  date: string
  notes: string
  period_key: string
  duplicate: boolean
}

type OfferMatch = {
  enrollment_id: string
  offer_id: string
  merchant: string
  total_spent_cents: number
  spend_min_cents: number
}

type ParseResult = {
  transaction_count: number
  benefit_matches: BenefitMatch[]
  offer_matches: OfferMatch[]
}

type ImportResult = {
  benefits_imported: number
  benefits_skipped: number
  offers_updated: number
}

type Stage = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error'

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

export default function ImportPage() {
  const [stage, setStage] = useState<Stage>('idle')
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsv(text)
    setStage('parsing')
    try {
      const res = await fetch('/api/transactions/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Parse failed')
      setPreview(data)
      setStage('preview')
    } catch (err) {
      setError(String(err))
      setStage('error')
    }
  }

  async function handleImport() {
    setStage('importing')
    try {
      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult(data)
      setStage('done')
    } catch (err) {
      setError(String(err))
      setStage('error')
    }
  }

  function reset() {
    setStage('idle')
    setCsv('')
    setPreview(null)
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const newMatches = preview?.benefit_matches.filter((m) => !m.duplicate) ?? []
  const dupMatches = preview?.benefit_matches.filter((m) => m.duplicate) ?? []
  const hasNewContent = newMatches.length > 0 || (preview?.offer_matches.length ?? 0) > 0

  return (
    <>
      <Nav />
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Import Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload your Amex CSV to detect benefit usage and offer progress.
          </p>
        </div>

        {stage === 'idle' && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500 mb-4">Select your Amex CSV file</p>
            <label className="cursor-pointer inline-block bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
              Choose file
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
            <p className="text-xs text-gray-400 mt-3">
              Download from americanexpress.com → Statements → Download CSV
            </p>
          </div>
        )}

        {(stage === 'parsing' || stage === 'importing') && (
          <div className="text-center py-10 text-sm text-gray-500">
            {stage === 'parsing' ? 'Analyzing transactions...' : 'Importing...'}
          </div>
        )}

        {stage === 'preview' && preview && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {preview.transaction_count} transactions scanned
            </p>

            {newMatches.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Benefit matches ({newMatches.length})
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {newMatches.map((m, i) => (
                    <div key={i} className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.benefit_name}</p>
                        <p className="text-xs text-gray-400">{m.date} · {m.notes}</p>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{dollars(m.amount_cents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dupMatches.length > 0 && (
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    Already imported — will skip ({dupMatches.length})
                  </span>
                </div>
                <div className="divide-y divide-amber-100">
                  {dupMatches.map((m, i) => (
                    <div key={i} className="px-4 py-3 flex justify-between items-center opacity-60">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.benefit_name}</p>
                        <p className="text-xs text-gray-400">{m.date} · {m.notes}</p>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{dollars(m.amount_cents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.offer_matches.length > 0 && (
              <div className="border border-green-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-green-50 border-b border-green-200">
                  <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                    Offer thresholds met ({preview.offer_matches.length})
                  </span>
                </div>
                <div className="divide-y divide-green-100">
                  {preview.offer_matches.map((m, i) => (
                    <div key={i} className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.merchant}</p>
                        <p className="text-xs text-gray-400">
                          Spent {dollars(m.total_spent_cents)} · min {dollars(m.spend_min_cents)}
                        </p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Threshold met
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasNewContent && (
              <div className="text-center py-6 text-sm text-gray-400">
                No new matches found in this CSV.
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleImport}
                disabled={!hasNewContent}
                className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                Confirm import
              </button>
              <button
                onClick={reset}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {stage === 'done' && result && (
          <div className="space-y-4">
            <div className="border border-green-200 bg-green-50 rounded-xl p-6 text-center">
              <p className="text-base font-semibold text-green-800">Import complete</p>
              <p className="text-sm text-green-700 mt-1">
                {result.benefits_imported} benefit {result.benefits_imported === 1 ? 'usage' : 'usages'} recorded
                {result.benefits_skipped > 0 && `, ${result.benefits_skipped} skipped`}
                {result.offers_updated > 0 &&
                  ` · ${result.offers_updated} offer${result.offers_updated === 1 ? '' : 's'} marked complete`}
              </p>
            </div>
            <div className="flex gap-4">
              <a href="/benefits" className="text-sm font-medium text-gray-900 underline underline-offset-2">
                View benefits
              </a>
              <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">
                Import another
              </button>
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={reset} className="ml-4 underline underline-offset-2 whitespace-nowrap">
              Try again
            </button>
          </div>
        )}
      </div>
    </>
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
git add src/app/import/page.tsx
git commit -m "feat: add /import page with CSV upload preview and confirm"
```

---

## Task 5: Add Import link to nav + final build + push

**Files:**
- Modify: `src/components/nav.tsx`

### Step 1: Add the Import link

Find the Offers link line:
```tsx
        <Link href="/offers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Offers</Link>
```

Replace with:
```tsx
        <Link href="/offers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Offers</Link>
        <Link href="/import" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Import</Link>
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
git add src/components/nav.tsx
git commit -m "feat: add Import nav link"
git pull --rebase origin master && git push origin master
```

---

## Done

- `/import` page: file picker → parse preview (benefit matches, duplicates, offer thresholds) → confirm → success summary
- `POST /api/transactions/parse`: preview only, dedup-aware, no DB writes
- `POST /api/transactions/import`: commit benefit_usage records (skipping duplicates) + update enrolled_offers threshold_met
- `matchToOffers()` in csv-parser.ts: fuzzy merchant match (normalize → includes), sums spend, returns matches >= threshold
- Future: budget dashboard will push to `/api/transactions/import` (budget dashboard is canonical import source)
