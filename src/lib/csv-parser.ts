export type ParsedTransaction = {
  date: string
  description: string
  amount: number
  category: string
  is_credit: boolean
}

export function parseAmexCSV(csv: string): ParsedTransaction[] {
  const lines = csv.trim().split(/\r?\n/)
  const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim())

  return lines.slice(1).map((line) => {
    const fields: string[] = []
    let current = ''
    let inQuote = false
    for (const char of line) {
      if (char === '"') { inQuote = !inQuote; continue }
      if (char === ',' && !inQuote) { fields.push(current); current = ''; continue }
      current += char
    }
    fields.push(current)

    const get = (key: string) => fields[headers.indexOf(key)]?.trim() ?? ''
    const amount = parseFloat(get('Amount')) || 0

    return {
      date: get('Date'),
      description: get('Description'),
      amount,
      category: get('Category'),
      is_credit: amount > 0,
    }
  }).filter((r) => r.date && r.description)
}

const BENEFIT_PATTERNS: Array<{ pattern: RegExp; benefit: string }> = [
  { pattern: /DIGITAL ENT|DISNEY|PEACOCK|ESPN|NYT|WALL ST/i, benefit: 'Digital Entertainment' },
  { pattern: /UBER CASH|UBER.*CREDIT/i, benefit: 'Uber Cash' },
  { pattern: /UBER ONE/i, benefit: 'Uber One Credit' },
  { pattern: /RESY/i, benefit: 'Resy Credit' },
  { pattern: /LULULEMON/i, benefit: 'lululemon Credit' },
  { pattern: /WALMART.*PLUS|WALMART.*CREDIT/i, benefit: 'Walmart+ Credit' },
  { pattern: /SAKS/i, benefit: 'Saks Fifth Avenue' },
  { pattern: /CLEAR.*CREDIT|CLEAR PLUS/i, benefit: 'CLEAR+ Credit' },
  { pattern: /AIRLINE.*CREDIT|ALASKA.*CREDIT/i, benefit: 'Airline Fee Credit' },
  { pattern: /HOTEL.*CREDIT|AMEX.*HOTEL/i, benefit: 'Hotel Credit' },
  { pattern: /EQUINOX/i, benefit: 'Equinox/SoulCycle' },
  { pattern: /OURA/i, benefit: 'Oura Ring Credit' },
]

export function matchToBenefit(description: string, amount: number): string | null {
  if (amount <= 0) return null
  for (const { pattern, benefit } of BENEFIT_PATTERNS) {
    if (pattern.test(description)) return benefit
  }
  return null
}

export function parseAmexDate(dateStr: string): Date {
  // Amex CSV date format: MM/DD/YYYY
  const [m, d, y] = dateStr.split('/')
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
}

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
