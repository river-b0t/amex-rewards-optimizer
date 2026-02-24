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
