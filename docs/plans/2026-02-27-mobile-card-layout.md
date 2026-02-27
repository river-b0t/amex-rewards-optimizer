# Mobile Card Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace fixed-column table layouts with responsive card layouts on mobile (below `md:` / 768px) for the offers table and expiring offers panel.

**Architecture:** CSS-only responsive switch. Each row component renders two sibling layouts: `hidden md:grid` for desktop, `md:hidden` for mobile cards. No JS, no state changes, no new components. Desktop behavior unchanged.

**Tech Stack:** Tailwind CSS responsive prefixes (`md:`). No new dependencies.

---

## Task 1: Mobile card layout for OfferRow + toolbar

**Files:**
- Modify: `src/components/offers/OfferCard.tsx`

### Changes

**1a. Container padding — mobile-safe**

Line 346 currently: `max-w-[1100px] mx-auto px-6 py-6`
Change to: `max-w-[1100px] mx-auto px-3 sm:px-6 py-6`

**1b. Toolbar row — stack on mobile**

Line ~366: `flex items-center justify-between mb-3 gap-4 flex-wrap`
Change to: `flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3`

**1c. Column headers — hide on mobile**

The column header row (the `div` with `${GRID} border-b border-gray-200 bg-[#fafafa]`):
Add `hidden md:grid` to replace the current grid class, keeping all other classes.
Before: `className={`${GRID} border-b border-gray-200 bg-[#fafafa] border-l-[3px] border-l-transparent`}`
After: `className={`hidden md:grid ${GRID} border-b border-gray-200 bg-[#fafafa] border-l-[3px] border-l-transparent`}`

**1d. OfferRow — add mobile card, keep desktop grid**

Change `OfferRow` to return a fragment with both layouts:

```tsx
function OfferRow({ offer, onToggle }: { offer: Offer; onToggle: (id: string) => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  const category = getCategory(offer.merchant)
  const reward = formatReward(offer)
  const expiry = formatExpiry(offer.expiration_date)

  async function handleToggle() {
    setLoading(true)
    try {
      await onToggle(offer.id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── Desktop row (md+) ── */}
      <div
        className={[
          'hidden md:grid',
          GRID,
          'items-center h-[44px] border-b border-[#f3f4f6] transition-colors',
          offer.is_enrolled
            ? 'border-l-[3px] border-l-green-600 hover:bg-green-50/60'
            : 'border-l-[3px] border-l-transparent hover:bg-[#f9fafb]',
        ].join(' ')}
      >
        {/* Merchant + description */}
        <div className="px-2 min-w-0">
          <p className="text-[14px] font-semibold text-gray-900 truncate leading-snug">{offer.merchant}</p>
          {offer.description && (
            <p className="text-[11px] text-gray-400 truncate leading-snug">{offer.description}</p>
          )}
        </div>

        {/* Category chip */}
        <div className="flex justify-center px-1">
          <span className="text-[10px] font-medium border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 whitespace-nowrap leading-tight">
            {category.emoji} {category.label}
          </span>
        </div>

        {/* Reward */}
        <div className="px-2 text-right">
          <span
            className={[
              'font-[var(--font-geist-mono)] text-[13px] font-bold tabular-nums',
              reward.isPoints ? 'text-blue-600' : 'text-green-700',
            ].join(' ')}
          >
            {reward.text}
          </span>
        </div>

        {/* Min spend */}
        <div className="px-2 text-right">
          <span className="font-[var(--font-geist-mono)] text-[13px] text-gray-500 tabular-nums">
            {formatMinSpend(offer.spend_min_cents)}
          </span>
        </div>

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

        {/* Expires */}
        <div className="px-2">
          {expiry ? (
            <span className={`text-[12px] tabular-nums ${expiry.urgent ? 'text-[#dc2626] font-bold' : 'text-gray-400'}`}>
              {expiry.text}
            </span>
          ) : (
            <span className="text-[12px] text-gray-300">—</span>
          )}
        </div>

        {/* Status */}
        <div className="flex justify-center">
          {offer.is_enrolled ? (
            <div className="flex items-center gap-1.5">
              <div className="w-[6px] h-[6px] rounded-full bg-green-500 shrink-0" />
              <span className="text-[11px] text-green-700 font-semibold">Enrolled</span>
            </div>
          ) : (
            <span className="text-[12px] text-gray-300">—</span>
          )}
        </div>

        {/* Action */}
        <div className="px-2 flex justify-end">
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading}
            className={[
              'text-[12px] font-semibold transition-colors disabled:opacity-30',
              offer.is_enrolled
                ? 'text-gray-400 hover:text-gray-700'
                : 'text-blue-600 hover:text-blue-800',
            ].join(' ')}
          >
            {loading ? '…' : offer.is_enrolled ? 'Unenroll' : 'Enroll'}
          </button>
        </div>
      </div>

      {/* ── Mobile card (<md) ── */}
      <div
        className={[
          'md:hidden px-3 py-2.5 border-b border-[#f3f4f6] transition-colors',
          offer.is_enrolled
            ? 'border-l-[3px] border-l-green-600 bg-green-50/30'
            : 'border-l-[3px] border-l-transparent',
        ].join(' ')}
      >
        {/* Row 1: merchant + reward */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-semibold text-gray-900 truncate flex-1">{offer.merchant}</p>
          <span
            className={[
              'font-[var(--font-geist-mono)] text-[14px] font-bold tabular-nums shrink-0',
              reward.isPoints ? 'text-blue-600' : 'text-green-700',
            ].join(' ')}
          >
            {reward.text}
          </span>
        </div>
        {/* Row 2: expiry/status + action */}
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[12px] text-gray-400">
            {expiry ? (
              <span className={expiry.urgent ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                {expiry.text}
              </span>
            ) : offer.is_enrolled ? (
              <span className="text-green-700 font-medium">Enrolled</span>
            ) : (
              '—'
            )}
          </span>
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading}
            className={[
              'text-[13px] font-semibold transition-colors disabled:opacity-30 py-1 pl-3',
              offer.is_enrolled
                ? 'text-gray-400 hover:text-gray-700'
                : 'text-blue-600 hover:text-blue-800',
            ].join(' ')}
          >
            {loading ? '…' : offer.is_enrolled ? 'Unenroll' : 'Enroll'}
          </button>
        </div>
      </div>
    </>
  )
}
```

### Build + commit
```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npm run build 2>&1 | tail -10
git add src/components/offers/OfferCard.tsx
git commit -m "feat: mobile card layout for offers table"
```

---

## Task 2: Mobile card layout for ExpiringOffersPanel

**Files:**
- Modify: `src/components/dashboard/ExpiringOffersPanel.tsx`

### Changes

**2a. Hide column headers on mobile**

The column headers div (line ~123):
Before: `className="grid grid-cols-[1fr_80px_60px_80px_80px] px-4 py-2 ..."`
After: `className="hidden md:grid grid-cols-[1fr_80px_60px_80px_80px] px-4 py-2 ..."`

**2b. Unenrolled offer rows — add mobile card**

Replace each unenrolled row `<div>` with a fragment containing desktop grid + mobile card:

```tsx
{unenrolledOffers.map((offer) => {
  const days = offer.expiration_date ? daysUntil(offer.expiration_date) : null
  return (
    <div key={offer.id}>
      {/* Desktop row */}
      <div className="hidden md:grid grid-cols-[1fr_80px_60px_80px_80px] items-center px-4 h-[44px] border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors">
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
      {/* Mobile card */}
      <div className="md:hidden px-4 py-2.5 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-semibold text-gray-900 truncate flex-1">{offer.merchant}</p>
          <span className="text-[14px] font-bold text-green-700 tabular-nums shrink-0">{formatReward(offer)}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className={`text-[12px] tabular-nums ${days !== null && days <= 7 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
            {days !== null ? `${days}d left` : '—'}
          </span>
          <EnrollButton offer={offer} />
        </div>
      </div>
    </div>
  )
})}
```

**2c. Enrolled offer rows — add mobile card**

Replace each enrolled row `<div>` with a fragment containing desktop grid + mobile card:

```tsx
{enrolledOffers.map((offer) => {
  const days = offer.expiration_date ? daysUntil(offer.expiration_date) : null
  return (
    <div key={offer.id}>
      {/* Desktop row */}
      <div className="hidden md:grid grid-cols-[1fr_80px_60px_80px_80px] items-center px-4 h-[44px] border-b border-gray-50 last:border-b-0 hover:bg-amber-50/30 transition-colors border-l-[3px] border-l-amber-400">
        <p className="text-[13px] font-semibold text-gray-900 truncate">{offer.merchant}</p>
        <p className="text-[13px] font-bold text-green-700 tabular-nums text-right">{formatReward(offer)}</p>
        <p className="text-[12px] text-gray-400 tabular-nums text-right">{formatReturn(offer)}</p>
        <p className={`text-[12px] tabular-nums text-right ${days !== null && days <= 7 ? 'text-red-600 font-bold' : 'text-amber-600'}`}>
          {days !== null ? `${days}d` : '—'}
        </p>
        <div className="flex justify-end">
          <SpendProgress
            spentCents={offer.spent_amount_cents ?? 0}
            minCents={offer.spend_min_cents}
          />
        </div>
      </div>
      {/* Mobile card */}
      <div className="md:hidden px-4 py-2.5 border-b border-gray-50 last:border-b-0 border-l-[3px] border-l-amber-400 hover:bg-amber-50/30 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-semibold text-gray-900 truncate flex-1">{offer.merchant}</p>
          <span className="text-[14px] font-bold text-green-700 tabular-nums shrink-0">{formatReward(offer)}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className={`text-[12px] tabular-nums ${days !== null && days <= 7 ? 'text-red-600 font-semibold' : 'text-amber-600'}`}>
            {days !== null ? `${days}d left` : '—'}
          </span>
          <SpendProgress
            spentCents={offer.spent_amount_cents ?? 0}
            minCents={offer.spend_min_cents}
          />
        </div>
      </div>
    </div>
  )
})}
```

### Build + commit
```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
npm run build 2>&1 | tail -10
git add src/components/dashboard/ExpiringOffersPanel.tsx
git commit -m "feat: mobile card layout for expiring offers panel"
```

---

## Task 3: Deploy

```bash
cd /Users/openclaw/river-workspace/amex-rewards-optimizer
git push
npx vercel --prod 2>&1 | tail -5
```

Report the production URL.

---

## Verification

- Resize browser to 375px width (iPhone size) — offers table shows 2-row cards, not 8 columns
- Desktop (>768px) — unchanged, full 8-column grid visible
- Search + filter chips still function on mobile
- ExpiringOffersPanel shows 2-row cards on mobile with correct amber/red styling for enrolled rows
- Enroll buttons on mobile cards are tappable (adequate size)
