'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export type Offer = {
  id: string
  merchant: string
  description: string | null
  spend_min_cents: number | null
  reward_amount_cents: number | null
  reward_type: string
  expiration_date: string | null
  is_enrolled: boolean
}

type SortKey = 'reward' | 'expiry' | 'merchant' | 'return'
type FilterKey = 'all' | 'enrolled' | 'expiring' | string

const PAGE_SIZE = 50

const CATEGORIES: Array<{ label: string; emoji: string; pattern: RegExp }> = [
  { label: 'Travel', emoji: '✈', pattern: /airline|hotel|marriott|hilton|hyatt|delta|united|american air|southwest|airbnb|hertz|avis|car rental|travel|resort|cruise|expedia|booking\.com/i },
  { label: 'Dining', emoji: '🍽', pattern: /restaurant|cafe|coffee|pizza|burger|sushi|grill|kitchen|starbucks|dunkin|mcdonald|chipotle|subway|doordash|food|dining|eatery|bistro|diner/i },
  { label: 'Retail', emoji: '🛍', pattern: /amazon|walmart|target|costco|best buy|home depot|lowes|macy|nordstrom|gap|h&m|zara|old navy|shop|store|retail|fashion|clothing|apparel/i },
  { label: 'Delivery', emoji: '📦', pattern: /instacart|gopuff|shipt|postmates|uber eats|grubhub|delivery/i },
  { label: 'Tech', emoji: '💻', pattern: /netflix|spotify|hulu|disney\+|apple|google|microsoft|adobe|software|streaming|tech|digital|cloud/i },
  { label: 'Gas', emoji: '⛽', pattern: /gas|fuel|shell|bp|exxon|chevron|mobil|sunoco|circle k|wawa/i },
  { label: 'Health', emoji: '💊', pattern: /pharmacy|cvs|walgreens|rite aid|health|medical|dental|vision|gym|fitness|peloton/i },
]

function getCategory(merchant: string): { label: string; emoji: string } {
  for (const cat of CATEGORIES) {
    if (cat.pattern.test(merchant)) return { label: cat.label, emoji: cat.emoji }
  }
  return { label: 'Other', emoji: '○' }
}

function formatReward(offer: Offer): { text: string; isPoints: boolean } {
  if (!offer.reward_amount_cents) return { text: '—', isPoints: false }
  if (offer.reward_type === 'points') {
    return { text: offer.reward_amount_cents.toLocaleString() + ' pts', isPoints: true }
  }
  const dollars = offer.reward_amount_cents / 100
  return { text: `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)} back`, isPoints: false }
}

function formatMinSpend(cents: number | null): string {
  if (!cents) return '—'
  return `$${Math.round(cents / 100).toLocaleString()}`
}

function computeReturn(offer: Offer): number | null {
  if (
    offer.reward_type === 'points' ||
    offer.spend_min_cents == null ||
    offer.reward_amount_cents == null ||
    offer.spend_min_cents === 0
  ) return null
  return Math.round((offer.reward_amount_cents / offer.spend_min_cents) * 100)
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatExpiry(dateStr: string | null): { text: string; urgent: boolean } | null {
  if (!dateStr) return null
  const days = daysUntil(dateStr)
  if (days < 0) return null
  const d = new Date(dateStr)
  const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (days <= 7) return { text: `${formatted} · ${days}d`, urgent: true }
  return { text: formatted, urgent: false }
}

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const days = daysUntil(dateStr)
  return days >= 0 && days <= 7
}

function compareExpiry(a: Offer, b: Offer): number {
  if (!a.expiration_date && !b.expiration_date) return 0
  if (!a.expiration_date) return 1
  if (!b.expiration_date) return -1
  return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime()
}

// ─── Grid column template ────────────────────────────────────────────────────
// Merchant(flex) | Category(80) | Reward(100) | MinSpend(90) | %Return(70) | Expires(110) | Status(80) | Action(100)
const GRID = 'grid grid-cols-[minmax(160px,1fr)_80px_100px_90px_70px_110px_80px_100px]'

// ─── Column header ───────────────────────────────────────────────────────────
function ColHeader({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <div className={`${a} text-[11px] font-medium uppercase tracking-[0.8px] text-gray-400 py-2.5 px-2`}>
      {children}
    </div>
  )
}

// ─── Group divider row ────────────────────────────────────────────────────────
function GroupRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 select-none bg-gray-50/60">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.8px]">{label}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  )
}

// ─── Individual offer row ─────────────────────────────────────────────────────
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
    <div
      className={[
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
  )
}

// ─── Sort pill button ─────────────────────────────────────────────────────────
function SortPill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'text-[12px] font-medium px-2.5 py-1 rounded transition-colors',
        active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ─── Filter chip button ───────────────────────────────────────────────────────
function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'text-[12px] font-medium px-2.5 py-1 rounded transition-colors',
        active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return 'just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

// ─── Main OffersTable component ───────────────────────────────────────────────
export function OffersTable({ offers: initial, lastSyncedAt }: { offers: Offer[]; lastSyncedAt?: string | null }) {
  const [offers, setOffers] = useState(initial)
  const [sortBy, setSortBy] = useState<SortKey>('reward')
  const [filterBy, setFilterBy] = useState<FilterKey>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch('/api/offers/sync-now', { method: 'POST' })
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  const toggleEnroll = useCallback(async (offerId: string) => {
    const res = await fetch('/api/offers/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: offerId }),
    })
    const data = await res.json()
    setOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, is_enrolled: data.enrolled } : o))
    )
  }, [])

  const uniqueCategories = useMemo(() => {
    const cats = new Set(offers.map((o) => getCategory(o.merchant).label).filter((c) => c !== 'Other'))
    return [...cats].sort()
  }, [offers])

  const enrolledCount = useMemo(() => offers.filter((o) => o.is_enrolled).length, [offers])
  const expiringSoonCount = useMemo(
    () => offers.filter((o) => isExpiringSoon(o.expiration_date)).length,
    [offers]
  )

  const filtered = useMemo(() => {
    // Always drop expired
    let result = offers.filter((o) => !o.expiration_date || daysUntil(o.expiration_date) >= 0)

    // Text search on merchant + description
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (o) =>
          o.merchant.toLowerCase().includes(q) ||
          (o.description?.toLowerCase().includes(q) ?? false)
      )
    }

    if (filterBy === 'enrolled') result = result.filter((o) => o.is_enrolled)
    else if (filterBy === 'expiring') result = result.filter((o) => isExpiringSoon(o.expiration_date))
    else if (filterBy !== 'all')
      result = result.filter((o) => getCategory(o.merchant).label === filterBy)
    return result
  }, [offers, filterBy, searchQuery])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [searchQuery])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'reward') return (b.reward_amount_cents ?? 0) - (a.reward_amount_cents ?? 0)
      if (sortBy === 'expiry') return compareExpiry(a, b)
      if (sortBy === 'return') {
        const aRet = computeReturn(a) ?? -1
        const bRet = computeReturn(b) ?? -1
        return bRet - aRet
      }
      return a.merchant.localeCompare(b.merchant)
    })
  }, [filtered, sortBy])

  const enrolled = sorted.filter((o) => o.is_enrolled)
  const unenrolled = sorted.filter((o) => !o.is_enrolled)
  const visibleUnenrolled = unenrolled.slice(0, visibleCount)
  const totalVisible = enrolled.length + visibleUnenrolled.length

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6">
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

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <div className="flex gap-0.5">
          <SortPill active={sortBy === 'reward'} onClick={() => setSortBy('reward')}>Reward ↓</SortPill>
          <SortPill active={sortBy === 'expiry'} onClick={() => setSortBy('expiry')}>Expiry ↑</SortPill>
          <SortPill active={sortBy === 'merchant'} onClick={() => setSortBy('merchant')}>Merchant A–Z</SortPill>
          <SortPill active={sortBy === 'return'} onClick={() => setSortBy('return')}>% Return ↓</SortPill>
        </div>
        <div className="flex flex-wrap gap-0.5 justify-end">
          <FilterChip active={filterBy === 'all'} onClick={() => setFilterBy('all')}>All</FilterChip>
          <FilterChip active={filterBy === 'enrolled'} onClick={() => setFilterBy('enrolled')}>
            Enrolled ({enrolledCount})
          </FilterChip>
          <FilterChip active={filterBy === 'expiring'} onClick={() => setFilterBy('expiring')}>
            Expiring Soon ({expiringSoonCount})
          </FilterChip>
          {uniqueCategories.map((cat) => (
            <FilterChip key={cat} active={filterBy === cat} onClick={() => setFilterBy(cat)}>
              {cat}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search merchants…"
          className="w-full text-[13px] border border-gray-200 rounded-md px-3 py-2 pr-8 focus:outline-none focus:border-gray-400 placeholder-gray-300"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[16px] leading-none"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Column headers */}
        <div className={`${GRID} border-b border-gray-200 bg-[#fafafa] border-l-[3px] border-l-transparent`}>
          <ColHeader>Merchant</ColHeader>
          <ColHeader align="center">Category</ColHeader>
          <ColHeader align="right">Reward</ColHeader>
          <ColHeader align="right">Min Spend</ColHeader>
          <ColHeader align="right">% Return</ColHeader>
          <ColHeader>Expires</ColHeader>
          <ColHeader align="center">Status</ColHeader>
          <ColHeader align="right">Action</ColHeader>
        </div>

        {/* Enrolled group */}
        {enrolled.length > 0 && (
          <>
            <GroupRow label={`Enrolled (${enrolled.length})`} />
            {enrolled.map((o) => (
              <OfferRow key={o.id} offer={o} onToggle={toggleEnroll} />
            ))}
          </>
        )}

        {/* All offers group */}
        {visibleUnenrolled.length > 0 && (
          <>
            <GroupRow label={`All Offers (${unenrolled.length})`} />
            {visibleUnenrolled.map((o) => (
              <OfferRow key={o.id} offer={o} onToggle={toggleEnroll} />
            ))}
          </>
        )}

        {sorted.length === 0 && (
          <div className="py-16 text-center text-[13px] text-gray-400">
            No offers match this filter.
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="mt-3 text-center text-[12px] text-gray-400">
        Showing {totalVisible.toLocaleString()} of {sorted.length.toLocaleString()} offers
        {visibleUnenrolled.length < unenrolled.length && (
          <>
            {' · '}
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="text-blue-500 hover:text-blue-700 font-medium"
            >
              Load more
            </button>
          </>
        )}
      </div>
    </div>
  )
}
