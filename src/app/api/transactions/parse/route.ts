import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseAmexCSV, matchToBenefit, matchToOffers, parseAmexDate, OfferMatchResult } from '@/lib/csv-parser'
import { getPeriodKey, ResetPeriod } from '@/lib/benefits'

type BenefitMatchResult = {
  benefit_id: string
  benefit_name: string
  amount_cents: number
  date: string
  notes: string
  period_key: string
  duplicate: boolean
}

export async function POST(req: NextRequest) {
  const { csv } = await req.json()
  if (!csv) return NextResponse.json({ error: 'csv required' }, { status: 400 })

  const transactions = parseAmexCSV(csv)
  const supabase = createServiceClient()

  // ── Benefits matching ──────────────────────────────────────────────
  const { data: benefits } = await supabase
    .from('amex_benefits')
    .select('id, name, reset_period')
    .eq('active', true)

  const benefitMatches: BenefitMatchResult[] = []

  for (const txn of transactions.filter((t) => t.is_credit)) {
    const benefitName = matchToBenefit(txn.description, txn.amount)
    if (!benefitName) continue
    const benefit = benefits?.find((b) => b.name === benefitName)
    if (!benefit) continue

    const txnDate = parseAmexDate(txn.date)
    const periodKey = getPeriodKey(benefit.reset_period as ResetPeriod, txnDate)
    const notes = txn.description
    const amount_cents = Math.round(txn.amount * 100)

    // Dedup: check if this exact usage record already exists
    const { data: existing } = await supabase
      .from('benefit_usage')
      .select('id')
      .eq('benefit_id', benefit.id)
      .eq('period_key', periodKey)
      .eq('notes', notes)
      .maybeSingle()

    benefitMatches.push({
      benefit_id: benefit.id,
      benefit_name: benefitName,
      amount_cents,
      date: txn.date,
      notes,
      period_key: periodKey,
      duplicate: !!existing,
    })
  }

  // ── Offers matching ───────────────────────────────────────────────
  const { data: enrolledOffers } = await supabase
    .from('enrolled_offers')
    .select('id, offer_id, amex_offers(merchant, spend_min_cents)')
    .eq('threshold_met', false)

  const offerInputs = (enrolledOffers ?? []).map((e) => ({
    enrollment_id: e.id as string,
    offer_id: e.offer_id as string,
    merchant: (e.amex_offers as unknown as { merchant: string; spend_min_cents: number | null } | null)?.merchant ?? '',
    spend_min_cents: (e.amex_offers as unknown as { merchant: string; spend_min_cents: number | null } | null)?.spend_min_cents ?? null,
  }))

  const offerMatches: OfferMatchResult[] = matchToOffers(transactions, offerInputs)

  return NextResponse.json({
    transaction_count: transactions.length,
    benefit_matches: benefitMatches,
    offer_matches: offerMatches,
  })
}
