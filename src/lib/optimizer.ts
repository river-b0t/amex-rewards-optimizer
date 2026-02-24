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

export type CardResult = {
  card: Card
  earn_rate: number
  earn_type: string
  category_matched: string
  notes: string | null
}

export function getBestCard(categoryQuery: string, cards: Card[]): CardResult[] {
  const results: CardResult[] = cards.map((card) => {
    const exact = card.card_categories.find((c) => c.category_name === categoryQuery)
    const fallback = card.card_categories.find((c) => c.category_name === 'everything_else')
    const match = exact ?? fallback

    return {
      card,
      earn_rate: match?.earn_rate ?? 1,
      earn_type: match?.earn_type ?? 'multiplier',
      category_matched: match?.category_name ?? 'everything_else',
      notes: match?.notes ?? null,
    }
  })

  // Sort by earn_rate descending, preserve original order for ties
  return results.sort((a, b) => b.earn_rate - a.earn_rate)
}
