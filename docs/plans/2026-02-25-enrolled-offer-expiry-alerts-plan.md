# Enrolled Offer Expiration Alerts — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a second section to the dashboard's Expiring Offers panel showing enrolled-but-incomplete offers expiring within 30 days, so users don't let enrolled offers expire without spending.

**Architecture:** Three-file change — dashboard API adds one new query, ExpiringOffersPanel gets a second section with a divider, page.tsx passes the new data through. No new components or DB migrations needed.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, Supabase JS v2.

---

## Reference

Key files to read before starting:
- `src/app/api/dashboard/route.ts` — existing dashboard API (add query after line 62, before benefits query)
- `src/components/dashboard/ExpiringOffersPanel.tsx` — client component to extend (currently 137 lines)
- `src/app/page.tsx` — server component, passes data to panels

Key schema facts:
- `enrolled_offers` table: `id`, `offer_id` (FK→amex_offers), `threshold_met` (boolean), `completed_at`
- `amex_offers` table: `merchant`, `reward_amount_cents`, `spend_min_cents`, `expiration_date`, `reward_type`, `active`
- Join pattern used elsewhere: `supabase.from('enrolled_offers').select('..., amex_offers!inner(...)')`

---

## Task 1: Add `enrolledExpiringOffers` to `GET /api/dashboard`

**Files:**
- Modify: `src/app/api/dashboard/route.ts`

### Step 1: Add the query

After the `unenrolledExpiringCount` block (after line 62) and before the benefits query (line 64), insert:

```typescript
  // 4b. Get enrolled offers expiring within 30 days (incomplete only)
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: rawEnrolledExpiring } = await supabase
    .from('enrolled_offers')
    .select('id, amex_offers!inner(merchant, reward_amount_cents, spend_min_cents, expiration_date, reward_type)')
    .eq('threshold_met', false)
    .gte('amex_offers.expiration_date', today)
    .lte('amex_offers.expiration_date', in30)
    .order('amex_offers.expiration_date', { ascending: true })

  const enrolledExpiringOffers = (rawEnrolledExpiring ?? []).map((row) => {
    const o = Array.isArray(row.amex_offers) ? row.amex_offers[0] : row.amex_offers
    return {
      id: row.id as string,
      merchant: (o as { merchant: string }).merchant,
      reward_amount_cents: (o as { reward_amount_cents: number | null }).reward_amount_cents,
      spend_min_cents: (o as { spend_min_cents: number | null }).spend_min_cents,
      expiration_date: (o as { expiration_date: string }).expiration_date,
      reward_type: (o as { reward_type: string }).reward_type,
    }
  })
```

### Step 2: Add `enrolledExpiringOffers` to the response

In the final `return NextResponse.json({...})` (currently line 129), add the new field:

```typescript
  return NextResponse.json({
    stats: {
      enrolledOffersCount: enrolledOffersCount ?? 0,
      expiringOffersCount: unenrolledExpiringCount,
      benefitsRemainingCents,
      valueCapturedYTDCents,
    },
    expiringOffers,
    enrolledExpiringOffers,   // ← add this line
    benefitsSummary,
  })
```

### Step 3: TypeScript check

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
```

Expected: clean (no errors). If Supabase complains about the nested filter syntax, try using `.filter('amex_offers.expiration_date', 'gte', today)` instead of `.gte('amex_offers.expiration_date', today)`.

### Step 4: Smoke test

```bash
npm run dev &
sleep 4
curl -s http://localhost:3000/api/dashboard | python3 -c "import sys,json; d=json.load(sys.stdin); print('enrolledExpiringOffers:', len(d.get('enrolledExpiringOffers', [])))"
pkill -f "next dev"
```

Expected: prints a number (0 or more, no crash).

### Step 5: Commit

```bash
git add src/app/api/dashboard/route.ts
git commit -m "feat: add enrolledExpiringOffers to dashboard API"
```

---

## Task 2: Extend `ExpiringOffersPanel` with enrolled section

**Files:**
- Modify: `src/components/dashboard/ExpiringOffersPanel.tsx`

The component currently accepts `{ offers: ExpiringOffer[] }`. We need to:
1. Rename prop `offers` → `unenrolledOffers`
2. Add `enrolledOffers` prop (same `ExpiringOffer` type)
3. Add section 2 with divider and different action column

### Step 1: Update the `ExpiringOffersPanelProps` and empty state

Replace the current function signature (line 81):
```typescript
// Before:
export function ExpiringOffersPanel({ offers }: { offers: ExpiringOffer[] }) {
  if (offers.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-[14px] font-semibold text-gray-900 mb-4">Expiring Offers</h2>
        <p className="text-[13px] text-gray-400">No unenrolled offers expiring in the next 14 days.</p>
      </div>
    )
  }
```

```typescript
// After:
export function ExpiringOffersPanel({
  unenrolledOffers,
  enrolledOffers,
}: {
  unenrolledOffers: ExpiringOffer[]
  enrolledOffers: ExpiringOffer[]
}) {
  if (unenrolledOffers.length === 0 && enrolledOffers.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-[14px] font-semibold text-gray-900 mb-4">Expiring Offers</h2>
        <p className="text-[13px] text-gray-400">No offers expiring soon.</p>
      </div>
    )
  }
```

### Step 2: Update header subtitle and rows to use renamed prop

Replace the header subtitle (line 96):
```typescript
// Before:
<span className="text-[11px] text-gray-400">Next 14 days · top {offers.length} by value</span>
// After:
<span className="text-[11px] text-gray-400">
  {unenrolledOffers.length > 0 && `${unenrolledOffers.length} to enroll`}
  {unenrolledOffers.length > 0 && enrolledOffers.length > 0 && ' · '}
  {enrolledOffers.length > 0 && `${enrolledOffers.length} enrolled`}
</span>
```

Replace the rows iterator (line 109):
```typescript
// Before:
{offers.map((offer) => {
// After:
{unenrolledOffers.map((offer) => {
```

### Step 3: Add section divider + enrolled rows after the unenrolled rows

Insert after the unenrolled rows block (after line 127, before the Footer comment):

```typescript
      {/* Enrolled section divider */}
      {enrolledOffers.length > 0 && (
        <>
          <div className="flex items-center gap-3 py-1.5 px-4 bg-amber-50/60 border-y border-amber-100">
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-[0.8px]">
              ⚠ Complete before they expire
            </span>
          </div>

          {enrolledOffers.map((offer) => {
            const days = offer.expiration_date ? daysUntil(offer.expiration_date) : null
            const minSpendText = offer.spend_min_cents
              ? `$${Math.round(offer.spend_min_cents / 100)} min · untracked`
              : 'No min'
            return (
              <div
                key={offer.id}
                className="grid grid-cols-[1fr_80px_60px_80px_80px] items-center px-4 h-[44px] border-b border-gray-50 last:border-b-0 hover:bg-amber-50/30 transition-colors border-l-[3px] border-l-amber-400"
              >
                <p className="text-[13px] font-semibold text-gray-900 truncate">{offer.merchant}</p>
                <p className="text-[13px] font-bold text-green-700 tabular-nums text-right">{formatReward(offer)}</p>
                <p className="text-[12px] text-gray-400 tabular-nums text-right">{formatReturn(offer)}</p>
                <p className={`text-[12px] tabular-nums text-right ${days !== null && days <= 7 ? 'text-red-600 font-bold' : 'text-amber-600'}`}>
                  {days !== null ? `${days}d` : '—'}
                </p>
                <div className="flex justify-end">
                  <span className="text-[11px] text-gray-400 text-right leading-tight">{minSpendText}</span>
                </div>
              </div>
            )
          })}
        </>
      )}
```

### Step 4: Add section label above unenrolled rows (only when enrolled section is also present)

Insert after the column headers block (after line 106, before the unenrolled rows):

```typescript
      {/* Unenrolled section label — only shown when both sections present */}
      {enrolledOffers.length > 0 && unenrolledOffers.length > 0 && (
        <div className="flex items-center gap-3 py-1.5 px-4 bg-blue-50/40 border-b border-blue-100">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-[0.8px]">
            Enroll before they're gone
          </span>
        </div>
      )}
```

### Step 5: TypeScript check

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
```

Expected: clean. The prop rename will cause a TypeScript error in `src/app/page.tsx` — that's expected and fixed in Task 3.

### Step 6: Commit

```bash
git add src/components/dashboard/ExpiringOffersPanel.tsx
git commit -m "feat: add enrolled-expiring section to ExpiringOffersPanel"
```

---

## Task 3: Update `page.tsx` to pass new props + update stat card label

**Files:**
- Modify: `src/app/page.tsx`

### Step 1: Destructure `enrolledExpiringOffers` from dashboard data

Replace line 19:
```typescript
// Before:
const { stats, expiringOffers, benefitsSummary } = data
// After:
const { stats, expiringOffers, enrolledExpiringOffers, benefitsSummary } = data
```

### Step 2: Update the stat card label

Replace the "Expiring in 14d" StatCard:
```typescript
// Before:
        <StatCard
          label="Expiring in 14d"
          value={stats.expiringOffersCount.toString()}
          subtext="unenrolled"
          accent={stats.expiringOffersCount > 0 ? 'amber' : 'default'}
        />
// After:
        <StatCard
          label="Expiring Soon"
          value={stats.expiringOffersCount.toString()}
          subtext="unenrolled, 14d"
          accent={stats.expiringOffersCount > 0 ? 'amber' : 'default'}
        />
```

### Step 3: Update ExpiringOffersPanel call with new props

Replace line 57:
```typescript
// Before:
        <ExpiringOffersPanel offers={expiringOffers} />
// After:
        <ExpiringOffersPanel
          unenrolledOffers={expiringOffers}
          enrolledOffers={enrolledExpiringOffers ?? []}
        />
```

### Step 4: TypeScript check + build

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20
```

Expected: both clean.

### Step 5: Commit + push

```bash
git add src/app/page.tsx
git commit -m "feat: wire enrolledExpiringOffers into dashboard; update stat card label"
git pull --rebase origin master && git push origin master
```

---

## Done

The Expiring Offers panel now has two sections:
- **Blue tinted:** "Enroll before they're gone" — unenrolled offers, 14d window, Enroll button
- **Amber tinted:** "Complete before they expire" — enrolled incomplete offers, 30d window, shows min spend as untracked note
