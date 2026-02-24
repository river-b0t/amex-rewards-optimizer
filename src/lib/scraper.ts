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

export async function scrapeFrequentMilerOffers(maxPages = 10): Promise<ScrapedOffer[]> {
  const offers: ScrapedOffer[] = []
  const seen = new Set<string>()
  let url: string | null = 'https://frequentmiler.com/current-amex-offers/'
  let page = 0

  while (url && page < maxPages) {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!res.ok) {
      console.error(`HTTP ${res.status} fetching ${url}`)
      break
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    // Table rows: tr with class starting with "row-" inside .tablepress or inside .td-post-content
    $('tr[class^="row-"]').each((_, el) => {
      const col1 = $(el).find('td.column-1')
      const col2 = $(el).find('td.column-2')
      if (!col1.length) return

      // Get the strong title (before description paragraph)
      const strongText = col1.find('strong').first().text().trim()
      if (!strongText) return

      // Get the first text node / paragraph after <strong> — description
      // Clone col1, remove details/summary/blockquote, get text
      const col1Clone = col1.clone()
      col1Clone.find('details').remove()
      const fullText = col1Clone.text().trim()

      // Expiration from col2 (YYYY-MM-DD) or fallback to parsing fullText
      const expirationRaw = col2.text().trim()
      const expiration_date = parseDate(expirationRaw) ?? parseDate(fullText)

      const merchant = parseMerchant(strongText)
      const description = fullText.replace(strongText, '').trim()

      // Determine reward type
      const reward_type = detectRewardType(strongText + ' ' + fullText)

      // Parse spend min from description text
      const spend_min_cents = parseSpendMin(fullText)

      // Parse reward amount: try dollar amount first, then pct-back
      let reward_amount_cents = parseRewardAmount(fullText)
      if (reward_amount_cents === null) {
        reward_amount_cents = parsePercentBack(fullText, spend_min_cents)
      }

      const offer: ScrapedOffer = {
        merchant,
        description: description.slice(0, 500), // cap length
        spend_min_cents,
        reward_amount_cents,
        reward_type,
        expiration_date,
      }

      const key = offerKey(offer)
      if (!seen.has(key)) {
        seen.add(key)
        offers.push(offer)
      }
    })

    // FrequentMiler's current-amex-offers page appears to be a single page (no pagination).
    // Check for a "Next" page link anyway in case the site adds pagination later.
    const nextLink =
      $('a.next').attr('href') ??
      $('a[rel="next"]').attr('href') ??
      $('.page-numbers.next').attr('href') ??
      null

    url = nextLink ?? null
    page++
  }

  // Keep offers that have a merchant name and either a dollar reward amount or a description
  // (percent-back offers without a hard cap still have value in the description)
  return offers.filter((o) => o.merchant && o.reward_amount_cents !== null)
}
