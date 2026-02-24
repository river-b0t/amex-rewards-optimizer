import { scrapeFrequentMilerOffers } from '../src/lib/scraper'

async function main() {
  console.log('Scraping FrequentMiler...')
  const offers = await scrapeFrequentMilerOffers(2)
  console.log(`Found ${offers.length} offers`)
  console.log('Sample:', JSON.stringify(offers.slice(0, 3), null, 2))

  // Stats breakdown
  const cashOffers = offers.filter((o) => o.reward_type === 'cash')
  const pointOffers = offers.filter((o) => o.reward_type === 'points')
  const withSpend = offers.filter((o) => o.spend_min_cents !== null)
  const withExpiry = offers.filter((o) => o.expiration_date !== null)
  console.log(`\nBreakdown:`)
  console.log(`  Cash offers:    ${cashOffers.length}`)
  console.log(`  Points offers:  ${pointOffers.length}`)
  console.log(`  With spend min: ${withSpend.length}`)
  console.log(`  With expiry:    ${withExpiry.length}`)
}

main().catch(console.error)
