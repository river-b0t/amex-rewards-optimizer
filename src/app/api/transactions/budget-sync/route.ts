import { NextRequest, NextResponse } from 'next/server'
// NextRequest used only for GET (cron auth)
import { createServiceClient } from '@/lib/supabase'
import { getAmexTransactions } from '@/lib/budget-db'
import { computeOfferSpend, matchBenefitsToTransactions } from '@/lib/transaction-matcher'
import type { ResetPeriod } from '@/lib/benefits'

// Vercel cron sends GET — requires CRON_SECRET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleSync()
}

// Manual trigger from dashboard UI — no token needed (API routes bypass site auth middleware)
export async function POST() {
  return handleSync()
}

async function handleSync() {

  if (!process.env.BUDGET_DATABASE_URL) {
    return NextResponse.json({ error: 'BUDGET_DATABASE_URL not configured' }, { status: 500 })
  }

  try {
    const supabase = createServiceClient()
    const syncedAt = new Date().toISOString()

    // 1. Fetch all Amex transactions from the budget dashboard DB
    const transactions = await getAmexTransactions()

    // 2. Load enrolled offers (threshold not yet met)
    const { data: enrolledRows } = await supabase
      .from('enrolled_offers')
      .select('id, offer_id, enrolled_at, spent_amount_cents, amex_offers(merchant, spend_min_cents)')
      .eq('threshold_met', false)

    // 3. Compute and update offer spend
    let offersUpdated = 0
    let offersCompleted = 0

    for (const row of enrolledRows ?? []) {
      const offer = Array.isArray(row.amex_offers) ? row.amex_offers[0] : row.amex_offers
      if (!offer || !row.enrolled_at) continue

      const spentCents = computeOfferSpend(
        (offer as { merchant: string }).merchant,
        row.enrolled_at as string,
        transactions
      )
      const minCents = (offer as { spend_min_cents: number | null }).spend_min_cents
      const thresholdMet = minCents != null && spentCents >= minCents

      await supabase
        .from('enrolled_offers')
        .update({
          spent_amount_cents: spentCents,
          threshold_met: thresholdMet,
          ...(thresholdMet ? { completed_at: syncedAt } : {}),
        })
        .eq('id', row.id)

      offersUpdated++
      if (thresholdMet) offersCompleted++
    }

    // 4. Load active enrolled benefits
    const { data: benefits } = await supabase
      .from('amex_benefits')
      .select('id, name, amount_cents, reset_period')
      .eq('active', true)
      .eq('enrolled', true)

    // 5. Compute benefit usage from transactions
    const benefitMatches = matchBenefitsToTransactions(
      (benefits ?? []).map((b) => ({
        id: b.id as string,
        name: b.name as string,
        amount_cents: b.amount_cents as number,
        reset_period: b.reset_period as ResetPeriod,
      })),
      transactions
    )

    // 6. Delete old budget_sync records and reinsert
    let benefitsSynced = 0
    for (const match of benefitMatches) {
      await supabase
        .from('benefit_usage')
        .delete()
        .eq('benefit_id', match.benefit_id)
        .eq('period_key', match.period_key)
        .eq('source', 'budget_sync')

      const { error } = await supabase.from('benefit_usage').insert({
        benefit_id: match.benefit_id,
        amount_used_cents: match.amount_used_cents,
        period_key: match.period_key,
        notes: 'Auto-synced from budget dashboard',
        source: 'budget_sync',
      })

      if (!error) benefitsSynced++
    }

    await supabase.from('sync_log').insert({
      type: 'budget_sync',
      records_processed: transactions.length,
      records_updated: offersUpdated + benefitsSynced,
      error: null,
    })

    return NextResponse.json({
      transactions_processed: transactions.length,
      offers_updated: offersUpdated,
      offers_completed: offersCompleted,
      benefits_synced: benefitsSynced,
      synced_at: syncedAt,
    })
  } catch (err) {
    try {
      const supabase = createServiceClient()
      await supabase.from('sync_log').insert({
        type: 'budget_sync',
        records_processed: 0,
        error: String(err),
      })
    } catch { /* ignore */ }
    console.error('[budget-sync] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
