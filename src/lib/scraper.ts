import * as cheerio from 'cheerio'

export type ScrapedOffer = {
  merchant: string
  description: string
  spend_min_cents: number | null
  reward_amount_cents: number | null
  reward_type: 'cash' | 'points'
  expiration_date: string | null
}

function parseDollarCents(text: string): number | null {
  const match = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/)
  if (!match) return null
  return Math.round(parseFloat(match[1].replace(/,/g, '')) * 100)
}

function parsePercentBack(text: string, spendMin: number | null): number | null {
  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*back/i)
  if (!pctMatch) return null

  // Try to extract the reward cap: "up to a total of $X" or "up to $X"
  const capMatch = text.match(/up\s+to\s+(?:a\s+total\s+of\s+)?\$\s*([\d,]+(?:\.\d{1,2})?)/i)
  if (capMatch) return Math.round(parseFloat(capMatch[1].replace(/,/g, '')) * 100)

  // Fallback: estimate from spend min if available
  if (spendMin !== null) {
    const pct = parseFloat(pctMatch[1]) / 100
    return Math.round(pct * spendMin)
  }

  return null
}

function parseSpendMin(text: string): number | null {
  // "Spend $X or more" or "spend a minimum of $X"
  const patterns = [
    /spend\s+(?:a\s+minimum\s+of\s+)?\$\s*([\d,]+(?:\.\d{1,2})?)/i,
    /minimum\s+of\s+\$\s*([\d,]+(?:\.\d{1,2})?)/i,
    /single\s+purchase\s+of\s+\$\s*([\d,]+(?:\.\d{1,2})?)/i,
    /purchase\s+of\s+\$\s*([\d,]+(?:\.\d{1,2})?)/i,
  ]
  for (const pat of patterns) {
    const m = text.match(pat)
    if (m) return Math.round(parseFloat(m[1].replace(/,/g, '')) * 100)
  }
  return null
}

function parseRewardAmount(text: string): number | null {
  // "earn $X back" or "earn a $X statement credit"
  const patterns = [
    /earn\s+(?:a\s+)?\$\s*([\d,]+(?:\.\d{1,2})?)\s*(?:statement\s+credit|back)/i,
    /\$\s*([\d,]+(?:\.\d{1,2})?)\s*(?:back|statement\s+credit)/i,
    /earn\s+\$\s*([\d,]+(?:\.\d{1,2})?)/i,
  ]
  for (const pat of patterns) {
    const m = text.match(pat)
    if (m) return Math.round(parseFloat(m[1].replace(/,/g, '')) * 100)
  }
  return null
}

function parseDate(text: string): string | null {
  // Table column-2 already has YYYY-MM-DD format; also handle MM/DD/YYYY in text
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return isoMatch[0]
  const usMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!usMatch) return null
  const [, m, d, y] = usMatch
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function detectRewardType(text: string): 'cash' | 'points' {
  if (/points?|miles?|MR\s+points/i.test(text)) return 'points'
  return 'cash'
}

function parseMerchant(strong: string): string {
  // Strong text format: "MerchantName: Offer title" — extract merchant portion
  const colonIdx = strong.indexOf(':')
  if (colonIdx > 0) return strong.slice(0, colonIdx).trim()
  return strong.trim()
}

// The page has duplicate rows (verbose + short version of same offer). Use a Set to deduplicate.
function offerKey(o: ScrapedOffer): string {
  return `${o.merchant}|${o.expiration_date}|${o.reward_amount_cents}|${o.spend_min_cents}`
}

// Extract the DataTables SSP ajax URL (with r+n tokens) from the page source.
// The token is page-load-specific and must be fetched fresh each scrape run.
async function getSSPUrl(): Promise<string | null> {
  const res = await fetch('https://frequentmiler.com/current-amex-offers/', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) return null

  const html = await res.text()
  // Match the ajax URL from DataTable('#tablepress-8', { ... ajax:'URL' ... })
  const match = html.match(/ajax:'(https:\/\/frequentmiler\.com\/wp-json\/tablepress\/v1\/ssp\/8[^']+)'/)
  return match ? match[1] : null
}

function parseRow(col1Html: string, col2Date: string): ScrapedOffer | null {
  const $ = cheerio.load(col1Html)

  const strongText = $('strong').first().text().trim()
  if (!strongText) return null

  // Remove <details> (terms block) before extracting description text
  $('details').remove()
  const fullText = $.text().trim()

  const expiration_date = parseDate(col2Date) ?? parseDate(fullText)
  const merchant = parseMerchant(strongText)
  const description = fullText.replace(strongText, '').trim()
  const reward_type = detectRewardType(strongText + ' ' + fullText)
  const spend_min_cents = parseSpendMin(fullText)
  let reward_amount_cents = parseRewardAmount(fullText)
  if (reward_amount_cents === null) {
    reward_amount_cents = parsePercentBack(fullText, spend_min_cents)
  }

  return {
    merchant,
    description: description.slice(0, 500),
    spend_min_cents,
    reward_amount_cents,
    reward_type,
    expiration_date,
  }
}

const PAGE_SIZE = 300 // FM truncates JSON beyond ~400 rows; 300 is safe

async function fetchSSPPage(sspBase: string, start: number, draw: number): Promise<{ data: [string, string][]; recordsTotal: number }> {
  const params = new URLSearchParams({
    draw: String(draw),
    start: String(start),
    length: String(PAGE_SIZE),
    'search[value]': '',
    'search[regex]': 'false',
    'columns[0][data]': '0',
    'columns[0][searchable]': 'true',
    'columns[1][data]': '1',
    'columns[1][searchable]': 'true',
    'order[0][column]': '1',
    'order[0][dir]': 'asc',
  })

  const res = await fetch(`${sspBase}&${params.toString()}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://frequentmiler.com/current-amex-offers/',
    },
  })

  if (!res.ok) throw new Error(`SSP API returned HTTP ${res.status}`)
  return res.json() as Promise<{ data: [string, string][]; recordsTotal: number }>
}

export async function scrapeFrequentMilerOffers(): Promise<ScrapedOffer[]> {
  const sspBase = await getSSPUrl()
  if (!sspBase) throw new Error('Failed to extract SSP URL from FrequentMiler page')

  const offers: ScrapedOffer[] = []
  const seen = new Set<string>()

  // Fetch first page to get total record count
  const first = await fetchSSPPage(sspBase, 0, 1)
  const total = first.recordsTotal ?? 0
  const allRows: [string, string][] = [...(first.data ?? [])]

  // Fetch remaining pages sequentially
  let draw = 2
  for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE) {
    const page = await fetchSSPPage(sspBase, start, draw++)
    allRows.push(...(page.data ?? []))
  }

  for (const [col1Html, col2Date] of allRows) {
    const offer = parseRow(col1Html, col2Date)
    if (!offer || !offer.merchant || offer.reward_amount_cents === null) continue

    const key = offerKey(offer)
    if (!seen.has(key)) {
      seen.add(key)
      offers.push(offer)
    }
  }

  return offers
}
