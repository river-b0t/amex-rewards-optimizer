import type { BudgetTransaction } from './budget-db'
import { getPeriodKey } from './benefits'
import type { ResetPeriod } from './benefits'

function normalizeMerchant(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ─── Offer matching ───────────────────────────────────────────────────────────

export function computeOfferSpend(
  offerMerchant: string,
  enrolledAt: string,
  transactions: BudgetTransaction[]
): number {
  const norm = normalizeMerchant(offerMerchant)
  if (!norm) return 0
  const enrolledDate = new Date(enrolledAt)
  return transactions
    .filter(
      (t) =>
        new Date(t.date) >= enrolledDate &&
        normalizeMerchant(t.description).includes(norm)
    )
    .reduce((sum, t) => sum + Math.round(t.amount * 100), 0)
}

// ─── Benefit matching ─────────────────────────────────────────────────────────

// Maps benefit name → normalized description substrings to match
const BENEFIT_PATTERNS: Record<string, string[]> = {
  'Digital Entertainment': ['disney', 'peacock', 'espn', 'nytimes', 'hulu', 'spotify', 'paramount', 'appletv', 'wsj', 'amcplus', 'appleone'],
  'Resy Credit':           ['resy'],
  'lululemon Credit':      ['lululemon'],
  'Uber Cash':             ['uber'],
  'Walmart+':              ['walmart'],
  'Saks':                  ['saks'],
  'Airline Fee Credit':    ['alaska', 'delta', 'united', 'americanair', 'southwest', 'jetblue', 'frontier'],
  'CLEAR+':                ['clearme', 'clear'],
  'Equinox':               ['equinox'],
  'Oura Ring':             ['oura'],
  // Hotel Credit: AmexTravel only — undetectable from generic transaction descriptions
  // Global Entry / TSA PreCheck: rare, undetectable reliably
}

export type BenefitMatchResult = {
  benefit_id: string
  benefit_name: string
  period_key: string
  amount_used_cents: number  // capped at benefit.amount_cents
}

type BenefitRow = {
  id: string
  name: string
  amount_cents: number
  reset_period: ResetPeriod
}

export function matchBenefitsToTransactions(
  benefits: BenefitRow[],
  transactions: BudgetTransaction[]
): BenefitMatchResult[] {
  const results: BenefitMatchResult[] = []
  const now = new Date()

  for (const benefit of benefits) {
    const patterns = BENEFIT_PATTERNS[benefit.name]
    if (!patterns) continue

    const periodKey = getPeriodKey(benefit.reset_period, now)

    // Determine period start date so we only look at current-period transactions
    const periodStart = getPeriodStart(benefit.reset_period, now)

    // Sum debits in this period that match any pattern
    const matchedCents = transactions
      .filter((t) => {
        if (new Date(t.date) < periodStart) return false
        const desc = normalizeMerchant(t.description)
        return patterns.some((p) => desc.includes(p))
      })
      .reduce((sum, t) => sum + Math.round(t.amount * 100), 0)

    if (matchedCents === 0) continue

    results.push({
      benefit_id: benefit.id,
      benefit_name: benefit.name,
      period_key: periodKey,
      amount_used_cents: Math.min(matchedCents, benefit.amount_cents),
    })
  }

  return results
}

// Returns the start of the current reset period for a given date
function getPeriodStart(resetPeriod: ResetPeriod, date: Date): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() // 0-indexed

  switch (resetPeriod) {
    case 'monthly':
      return new Date(Date.UTC(year, month, 1))
    case 'quarterly': {
      const qStartMonth = Math.floor(month / 3) * 3
      return new Date(Date.UTC(year, qStartMonth, 1))
    }
    case 'semi-annual':
      return new Date(Date.UTC(year, month < 6 ? 0 : 6, 1))
    case 'annual':
    case '4-year':
      return new Date(Date.UTC(year, 0, 1))
  }
}
