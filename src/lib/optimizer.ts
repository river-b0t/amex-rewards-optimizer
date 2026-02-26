type Category = {
  category_name: string
  earn_rate: number
  earn_type: string
  notes: string | null
}

type Card = {
  id: string
  name: string
  reward_currency: string
  color?: string
  card_categories: Category[]
}

export type OtherCategory = {
  category_name: string
  earn_rate: number
  earn_type: string
}

export type CardResult = {
  card: Card
  earn_rate: number
  earn_type: string
  category_matched: string
  notes: string | null
  other_categories: OtherCategory[]
}

const MERCHANT_ALIASES: Record<string, string> = {
  // Rideshare
  uber: 'rideshare',
  lyft: 'rideshare',
  'uber eats': 'rideshare',
  // Flights
  delta: 'flights',
  united: 'flights',
  american: 'flights',
  southwest: 'flights',
  jetblue: 'flights',
  frontier: 'flights',
  'spirit airlines': 'flights',
  // Alaska Airlines
  alaska: 'alaska_airlines',
  'alaska airlines': 'alaska_airlines',
  'alaska air': 'alaska_airlines',
  // Prepaid Hotels
  marriott: 'prepaid_hotels',
  hilton: 'prepaid_hotels',
  hyatt: 'prepaid_hotels',
  ihg: 'prepaid_hotels',
  airbnb: 'prepaid_hotels',
  'four seasons': 'prepaid_hotels',
  // Grocery
  'whole foods': 'grocery',
  safeway: 'grocery',
  kroger: 'grocery',
  albertsons: 'grocery',
  "trader joe's": 'grocery',
  sprouts: 'grocery',
  costco: 'grocery',
  aldi: 'grocery',
  publix: 'grocery',
  // Gas
  chevron: 'gas',
  shell: 'gas',
  exxon: 'gas',
  mobil: 'gas',
  arco: 'gas',
  bp: 'gas',
  '76': 'gas',
  texaco: 'gas',
  // Transit
  amtrak: 'transit',
  bart: 'transit',
  muni: 'transit',
  metro: 'transit',
  caltrain: 'transit',
  // EV Charging
  tesla: 'ev_charging',
  'tesla supercharger': 'ev_charging',
  blink: 'ev_charging',
  chargepoint: 'ev_charging',
  electrify: 'ev_charging',
}

function resolveCategory(query: string, knownCategories: string[]): string {
  const normalized = query.toLowerCase().trim()

  // 1. Alias map (merchant names → category slug)
  if (MERCHANT_ALIASES[normalized]) {
    return MERCHANT_ALIASES[normalized]
  }

  // 2. Substring match against category slugs (spaces = underscores)
  const match = knownCategories.find((cat) => {
    if (cat === 'everything_else') return false
    const catNorm = cat.replace(/_/g, ' ')
    const queryNorm = normalized.replace(/_/g, ' ')
    return catNorm.includes(queryNorm) || queryNorm.includes(catNorm)
  })
  if (match) return match

  return 'everything_else'
}

export function getCardResults(query: string, cards: Card[]): CardResult[] {
  const allCategories = [
    ...new Set(cards.flatMap((c) => c.card_categories.map((cc) => cc.category_name))),
  ]

  const resolved = resolveCategory(query, allCategories)

  const results: CardResult[] = cards.map((card) => {
    const matched =
      card.card_categories.find((c) => c.category_name === resolved) ??
      card.card_categories.find((c) => c.category_name === 'everything_else')

    const other_categories = card.card_categories
      .filter((c) => c.category_name !== matched?.category_name)
      .sort((a, b) => b.earn_rate - a.earn_rate)
      .slice(0, 4)
      .map((c) => ({
        category_name: c.category_name,
        earn_rate: c.earn_rate,
        earn_type: c.earn_type,
      }))

    return {
      card,
      earn_rate: matched?.earn_rate ?? 1,
      earn_type: matched?.earn_type ?? 'multiplier',
      category_matched: matched?.category_name ?? 'everything_else',
      notes: matched?.notes ?? null,
      other_categories,
    }
  })

  return results.sort((a, b) => b.earn_rate - a.earn_rate)
}

// Alias for backwards compatibility with any direct callers
export { getCardResults as getBestCard }
