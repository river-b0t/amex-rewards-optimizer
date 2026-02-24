import { OffersTable } from '@/components/offers/OfferCard'
import type { Offer } from '@/components/offers/OfferCard'

async function getOffers(): Promise<Offer[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/offers`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

export default async function OffersPage() {
  const offers = await getOffers()
  return <OffersTable offers={offers} />
}
