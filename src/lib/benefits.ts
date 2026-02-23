export type ResetPeriod = 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | '4-year'

export function getPeriodKey(resetPeriod: ResetPeriod, date: Date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1

  switch (resetPeriod) {
    case 'monthly':
      return `${year}-${String(month).padStart(2, '0')}`
    case 'quarterly':
      return `${year}-Q${Math.ceil(month / 3)}`
    case 'semi-annual':
      return `${year}-H${month <= 6 ? 1 : 2}`
    case 'annual':
    case '4-year':
      return `${year}`
  }
}

export function getRemainingCents(totalCents: number, usedAmounts: number[]): number {
  const used = usedAmounts.reduce((sum, v) => sum + v, 0)
  return Math.max(0, totalCents - used)
}

export function isExpiringSoon(resetPeriod: ResetPeriod, date: Date = new Date()): boolean {
  const day = date.getUTCDate()
  const month = date.getUTCMonth() + 1

  switch (resetPeriod) {
    case 'monthly':
      return day >= 20
    case 'quarterly': {
      const lastMonthOfQ = Math.ceil(month / 3) * 3
      return month === lastMonthOfQ && day >= 20
    }
    case 'semi-annual': {
      return (month === 6 || month === 12) && day >= 20
    }
    default:
      return false
  }
}
