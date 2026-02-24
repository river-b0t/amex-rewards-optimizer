import { OfferCard } from '@/components/offers/OfferCard'
import type { Offer } from '@/components/offers/OfferCard'

async function getOffers(): Promise<Offer[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/offers`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

export default async function OffersPage() {
  const offers = await getOffers()
  const enrolled = offers.filter((o) => o.is_enrolled)
  const all = offers.filter((o) => !o.is_enrolled)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Amex Offers</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {offers.length} active offers · {enrolled.length} enrolled
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Source: frequentmiler.com — mark only offers that appear on your card.
        </p>
      </div>

      {enrolled.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Your Enrolled Offers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrolled.map((o) => <OfferCard key={o.id} offer={o} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">
          {enrolled.length > 0 ? 'All Other Offers' : 'All Offers'}
        </h2>
        {all.length === 0 && offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No offers yet. Run the scraper to populate:
            <code className="ml-1 bg-slate-100 px-1 rounded text-xs">npm run scrape</code>
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {all.map((o) => <OfferCard key={o.id} offer={o} />)}
          </div>
        )}
      </section>
    </div>
  )
}
