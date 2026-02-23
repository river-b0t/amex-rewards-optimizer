import { getPeriodKey, getRemainingCents, isExpiringSoon } from '@/lib/benefits'

describe('getPeriodKey', () => {
  it('returns YYYY-MM for monthly', () => {
    expect(getPeriodKey('monthly', new Date('2026-03-15'))).toBe('2026-03')
  })
  it('returns YYYY-Q# for quarterly', () => {
    expect(getPeriodKey('quarterly', new Date('2026-03-15'))).toBe('2026-Q1')
    expect(getPeriodKey('quarterly', new Date('2026-07-01'))).toBe('2026-Q3')
  })
  it('returns YYYY-H# for semi-annual', () => {
    expect(getPeriodKey('semi-annual', new Date('2026-03-15'))).toBe('2026-H1')
    expect(getPeriodKey('semi-annual', new Date('2026-08-01'))).toBe('2026-H2')
  })
  it('returns YYYY for annual', () => {
    expect(getPeriodKey('annual', new Date('2026-06-01'))).toBe('2026')
  })
})

describe('getRemainingCents', () => {
  it('returns full amount when no usage', () => {
    expect(getRemainingCents(20000, [])).toBe(20000)
  })
  it('subtracts usage from total', () => {
    expect(getRemainingCents(20000, [5000, 8000])).toBe(7000)
  })
  it('floors at 0 when over-used', () => {
    expect(getRemainingCents(10000, [12000])).toBe(0)
  })
})

describe('isExpiringSoon', () => {
  it('returns true if monthly benefit and today is after 20th', () => {
    expect(isExpiringSoon('monthly', new Date('2026-03-21'))).toBe(true)
  })
  it('returns false if monthly benefit and today is before 20th', () => {
    expect(isExpiringSoon('monthly', new Date('2026-03-10'))).toBe(false)
  })
  it('returns true if quarterly benefit and within last 10 days of quarter', () => {
    expect(isExpiringSoon('quarterly', new Date('2026-03-25'))).toBe(true)
  })
  it('returns false if quarterly benefit not near end of quarter', () => {
    expect(isExpiringSoon('quarterly', new Date('2026-02-10'))).toBe(false)
  })
  it('returns true if semi-annual benefit and month is June, day >= 20', () => {
    expect(isExpiringSoon('semi-annual', new Date('2026-06-21'))).toBe(true)
  })
  it('returns false if semi-annual benefit and not near end of period', () => {
    expect(isExpiringSoon('semi-annual', new Date('2026-03-15'))).toBe(false)
  })
})
