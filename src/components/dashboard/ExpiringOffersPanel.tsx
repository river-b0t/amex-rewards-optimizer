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
        {(['Merchant', 'Reward', '% Ret', 'Expires', ''] as const).map((h, i) => (
          <div key={i} className={`text-[10px] font-medium uppercase tracking-[0.8px] text-gray-400 ${i > 0 ? 'text-right' : ''}`}>
            {h}
          </div>
        ))}
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
