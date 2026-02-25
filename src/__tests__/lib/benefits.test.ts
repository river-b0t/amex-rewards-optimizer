import { getPeriodKey, getRemainingCents, isExpiringSoon, getPeriodEnd } from '@/lib/benefits'

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

describe('getPeriodEnd', () => {
  it('monthly: returns last day of current month', () => {
    const date = new Date('2026-02-15T00:00:00Z')
    const end = getPeriodEnd('monthly', date)
    expect(end.toISOString().startsWith('2026-02-28')).toBe(true)
  })

  it('quarterly: returns last day of Q1 when in February', () => {
    const date = new Date('2026-02-15T00:00:00Z')
    const end = getPeriodEnd('quarterly', date)
    expect(end.toISOString().startsWith('2026-03-31')).toBe(true)
  })

  it('semi-annual: returns June 30 when in H1', () => {
    const date = new Date('2026-03-01T00:00:00Z')
    const end = getPeriodEnd('semi-annual', date)
    expect(end.toISOString().startsWith('2026-06-30')).toBe(true)
  })

  it('semi-annual: returns Dec 31 when in H2', () => {
    const date = new Date('2026-08-01T00:00:00Z')
    const end = getPeriodEnd('semi-annual', date)
    expect(end.toISOString().startsWith('2026-12-31')).toBe(true)
  })

  it('annual: returns Dec 31 of current year', () => {
    const date = new Date('2026-05-01T00:00:00Z')
    const end = getPeriodEnd('annual', date)
    expect(end.toISOString().startsWith('2026-12-31')).toBe(true)
  })

  it('4-year: returns Dec 31 of current year', () => {
    const date = new Date('2026-05-01T00:00:00Z')
    const end = getPeriodEnd('4-year', date)
    expect(end.toISOString().startsWith('2026-12-31')).toBe(true)
  })
})
