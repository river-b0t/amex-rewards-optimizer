'use client'

import { useState } from 'react'
import Link from 'next/link'

function SpendProgress({ spentCents, minCents }: { spentCents: number; minCents: number | null }) {
  if (!minCents) return <span className="text-[11px] text-gray-400">No min</span>
  const spent = spentCents / 100
  const min = minCents / 100
  const done = spentCents >= minCents
  return (
    <span className={`text-[11px] tabular-nums font-medium ${done ? 'text-green-600' : 'text-amber-600'}`}>
      ${spent % 1 === 0 ? spent.toFixed(0) : spent.toFixed(2)} / ${min % 1 === 0 ? min.toFixed(0) : min.toFixed(2)}
    </span>
  )
}

type ExpiringOffer = {
  id: string
  merchant: string
  reward_amount_cents: number | null
  spend_min_cents: number | null
  expiration_date: string | null
  reward_type: string
  spent_amount_cents?: number
}

function formatReward(offer: ExpiringOffer): string {
  if (offer.reward_amount_cents == null) return '—'
  if (offer.reward_type === 'points') {
    return offer.reward_amount_cents.toLocaleString() + ' pts'
  }
  const d = offer.reward_amount_cents / 100
  return `$${d % 1 === 0 ? d.toFixed(0) : d.toFixed(2)}`
}

function formatReturn(offer: ExpiringOffer): string {
  if (
    offer.reward_type === 'points' ||
    offer.spend_min_cents == null ||
    offer.reward_amount_cents == null ||
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
    try {
      const res = await fetch('/api/offers/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offer.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setEnrolled(data.enrolled)
      }
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-[#fafafa]">
        <h2 className="text-[14px] font-semibold text-gray-900">Expiring Offers</h2>
        <span className="text-[11px] text-gray-400">
          {unenrolledOffers.length > 0 && `${unenrolledOffers.length} to enroll`}
          {unenrolledOffers.length > 0 && enrolledOffers.length > 0 && ' · '}
          {enrolledOffers.length > 0 && `${enrolledOffers.length} enrolled`}
        </span>
      </div>

      {/* Column headers */}
      <div className="hidden md:grid grid-cols-[1fr_80px_60px_80px_80px] px-4 py-2 border-b border-gray-100 bg-[#fafafa]">
        {(['Merchant', 'Reward', '% Ret', 'Expires', ''] as const).map((h, i) => (
          <div key={i} className={`text-[10px] font-medium uppercase tracking-[0.8px] text-gray-400 ${i > 0 ? 'text-right' : ''}`}>
            {h}
          </div>
        ))}
      </div>

      {/* Unenrolled section label — only shown when both sections present */}
      {enrolledOffers.length > 0 && unenrolledOffers.length > 0 && (
        <div className="flex items-center gap-3 py-1.5 px-4 bg-blue-50/40 border-b border-blue-100">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-[0.8px]">
            Enroll before they're gone
          </span>
        </div>
      )}

      {/* Rows */}
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

      {/* Enrolled section */}
      {enrolledOffers.length > 0 && (
        <>
          <div className="flex items-center gap-3 py-1.5 px-4 bg-amber-50/60 border-y border-amber-100">
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-[0.8px]">
              ⚠ Complete before they expire
            </span>
          </div>

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
        </>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-[#fafafa]">
        <Link href="/offers" className="text-[12px] text-blue-600 hover:text-blue-800 font-medium">
          View all offers →
        </Link>
      </div>
    </div>
  )
}
