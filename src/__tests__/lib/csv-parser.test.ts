import { parseAmexCSV, matchToBenefit } from '@/lib/csv-parser'

const SAMPLE_CSV = `Date,Description,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
01/15/2026,"DISNEY PLUS",-12.99,"",DISNEY PLUS,,,,USA,,Entertainment
01/15/2026,"AMEX CREDIT - DIGITAL ENT",25.00,"","AMEX CREDIT",,,,USA,,Credit
`

describe('parseAmexCSV', () => {
  it('parses transactions from Amex CSV', () => {
    const rows = parseAmexCSV(SAMPLE_CSV)
    expect(rows).toHaveLength(2)
    expect(rows[0].description).toContain('DISNEY')
    expect(rows[0].amount).toBe(-12.99)
  })

  it('identifies positive rows as credits', () => {
    const rows = parseAmexCSV(SAMPLE_CSV)
    expect(rows[1].amount).toBe(25.00)
    expect(rows[1].is_credit).toBe(true)
  })
})

describe('matchToBenefit', () => {
  it('matches digital entertainment credit', () => {
    const match = matchToBenefit('AMEX CREDIT - DIGITAL ENT', 25.00)
    expect(match).toBe('Digital Entertainment')
  })

  it('returns null if no match', () => {
    const match = matchToBenefit('WHOLE FOODS', -45.00)
    expect(match).toBeNull()
  })
})
