import { getBestCard } from '@/lib/optimizer'

const mockCards = [
  {
    id: '1',
    name: 'Amex Platinum',
    reward_currency: 'MR',
    color: '#1a1a2e',
    card_categories: [
      { category_name: 'flights', earn_rate: 5, earn_type: 'multiplier', notes: null },
      { category_name: 'prepaid_hotels', earn_rate: 5, earn_type: 'multiplier', notes: null },
      { category_name: 'everything_else', earn_rate: 1, earn_type: 'multiplier', notes: null },
    ],
  },
  {
    id: '2',
    name: 'Alaska Visa',
    reward_currency: 'miles',
    color: '#01426a',
    card_categories: [
      { category_name: 'grocery', earn_rate: 2, earn_type: 'multiplier', notes: null },
      { category_name: 'alaska_airlines', earn_rate: 3, earn_type: 'multiplier', notes: null },
      { category_name: 'everything_else', earn_rate: 1, earn_type: 'multiplier', notes: null },
    ],
  },
  {
    id: '3',
    name: 'Discover it',
    reward_currency: 'cashback',
    color: '#f76400',
    card_categories: [
      { category_name: 'grocery_q1_2026', earn_rate: 5, earn_type: 'percent', notes: '5% Jan-Mar 2026' },
      { category_name: 'everything_else', earn_rate: 1, earn_type: 'percent', notes: null },
    ],
  },
]

describe('getBestCard', () => {
  it('ranks Platinum first for flights', () => {
    const result = getBestCard('flights', mockCards)
    expect(result[0].card.name).toBe('Amex Platinum')
    expect(result[0].earn_rate).toBe(5)
  })

  it('ranks Alaska first for grocery', () => {
    const result = getBestCard('grocery', mockCards)
    expect(result[0].card.name).toBe('Alaska Visa')
    expect(result[0].earn_rate).toBe(2)
  })

  it('falls back to everything_else when no exact match', () => {
    const result = getBestCard('dining', mockCards)
    // All cards fall back to 1x/1% — Platinum first by stable sort or position
    expect(result.every((r) => r.earn_rate === 1)).toBe(true)
    expect(result[0].category_matched).toBe('everything_else')
  })

  it('returns all three cards in result', () => {
    const result = getBestCard('flights', mockCards)
    expect(result).toHaveLength(3)
  })

  it('marks the category that was matched', () => {
    const result = getBestCard('flights', mockCards)
    expect(result[0].category_matched).toBe('flights')
  })

  it('ranks Alaska first for alaska_airlines', () => {
    const result = getBestCard('alaska_airlines', mockCards)
    expect(result[0].card.name).toBe('Alaska Visa')
    expect(result[0].earn_rate).toBe(3)
  })
})
