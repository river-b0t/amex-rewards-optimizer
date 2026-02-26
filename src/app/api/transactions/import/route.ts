import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseAmexCSV, matchToBenefit, matchToOffers, parseAmexDate } from '@/lib/csv-parser'
import { getPeriodKey, ResetPeriod } from '@/lib/benefits'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { csv } = body as { csv?: string }
  if (!csv) return NextResponse.json({ error: 'csv required' }, { status: 400 })

  const transactions = parseAmexCSV(csv)
  const supabase = createServiceClient()

  // ── Benefits ──────────────────────────────────────────────────────
  const { data: benefits, error: benefitsError } = await supabase
    .from('amex_benefits')
    .select('id, name, reset_period')
    .eq('active', true)
  if (benefitsError) return NextResponse.json({ error: benefitsError.message }, { status: 500 })

  let benefitsImported = 0
  let benefitsSkipped = 0

  for (const txn of transactions.filter((t) => t.is_credit)) {
    const benefitName = matchToBenefit(txn.description, txn.amount)
    if (!benefitName) continue
    const benefit = benefits?.find((b) => b.name === benefitName)
    if (!benefit) continue

    const txnDate = parseAmexDate(txn.date)
    const periodKey = getPeriodKey(benefit.reset_period as ResetPeriod, txnDate)
    const notes = txn.description

    // Dedup check
    const { data: existing } = await supabase
      .from('benefit_usage')
      .select('id')
      .eq('benefit_id', benefit.id)
      .eq('period_key', periodKey)
      .eq('notes', notes)
      .maybeSingle()

    if (existing) {
      benefitsSkipped++
      continue
    }

    const { error } = await supabase.from('benefit_usage').insert({
      benefit_id: benefit.id,
      amount_used_cents: Math.round(txn.amount * 100),
      period_key: periodKey,
      notes,
      source: 'csv',
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    benefitsImported++
  }

  // ── Offers ────────────────────────────────────────────────────────
  const { data: enrolledOffers, error: offersError } = await supabase
    .from('enrolled_offers')
    .select('id, offer_id, amex_offers(merchant, spend_min_cents)')
    .eq('threshold_met', false)
  if (offersError) return NextResponse.json({ error: offersError.message }, { status: 500 })

  const offerInputs = (enrolledOffers ?? []).map((e) => ({
    enrollment_id: e.id as string,
    offer_id: e.offer_id as string,
    merchant: (e.amex_offers as unknown as { merchant: string; spend_min_cents: number | null } | null)?.merchant ?? '',
    spend_min_cents: (e.amex_offers as unknown as { merchant: string; spend_min_cents: number | null } | null)?.spend_min_cents ?? null,
  }))

  const offerMatches = matchToOffers(transactions, offerInputs)
  let offersUpdated = 0

  for (const match of offerMatches) {
    const { error } = await supabase
      .from('enrolled_offers')
      .update({
        threshold_met: true,
        completed_at: new Date().toISOString(),
        spent_amount_cents: match.total_spent_cents,
      })
      .eq('id', match.enrollment_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    offersUpdated++
  }

  return NextResponse.json({
    benefits_imported: benefitsImported,
    benefits_skipped: benefitsSkipped,
    offers_updated: offersUpdated,
  })
}
