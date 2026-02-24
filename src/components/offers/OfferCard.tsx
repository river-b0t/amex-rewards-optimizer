'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

const dollars = (cents: number) => `$${(cents / 100).toFixed(0)}`

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function OfferCard({ offer: initial }: { offer: Offer }) {
  const [offer, setOffer] = useState(initial)
  const [loading, setLoading] = useState(false)

  async function toggleEnroll() {
    setLoading(true)
    const res = await fetch('/api/offers/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: offer.id }),
    })
    const data = await res.json()
    setOffer((o) => ({ ...o, is_enrolled: data.enrolled }))
    setLoading(false)
  }

  const expiringSoon = offer.expiration_date && daysUntil(offer.expiration_date) <= 7
  const expired = offer.expiration_date && daysUntil(offer.expiration_date) < 0

  if (expired) return null

  return (
    <Card className={offer.is_enrolled ? 'border-green-400 bg-green-50' : ''}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm leading-tight">{offer.merchant}</p>
          <div className="flex gap-1 shrink-0">
            {offer.is_enrolled && <Badge className="bg-green-600 text-xs">Enrolled</Badge>}
            {expiringSoon && !expired && (
              <Badge variant="destructive" className="text-xs">
                Expires soon
              </Badge>
            )}
          </div>
        </div>

        {offer.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{offer.description}</p>
        )}

        <div className="flex items-end justify-between gap-2">
          <div className="text-xs space-y-0.5">
            {offer.spend_min_cents && (
              <p>Spend {dollars(offer.spend_min_cents)}</p>
            )}
            {offer.reward_amount_cents && (
              <p className="font-semibold text-green-700 text-sm">
                Get {dollars(offer.reward_amount_cents)}{' '}
                {offer.reward_type === 'points' ? 'bonus pts' : 'back'}
              </p>
            )}
            {offer.expiration_date && (
              <p className="text-muted-foreground">
                Expires {offer.expiration_date}
                {expiringSoon && ` (${daysUntil(offer.expiration_date)}d left)`}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant={offer.is_enrolled ? 'outline' : 'default'}
            onClick={toggleEnroll}
            disabled={loading}
            className="shrink-0"
          >
            {loading ? '...' : offer.is_enrolled ? 'Unenroll' : 'Mark enrolled'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
