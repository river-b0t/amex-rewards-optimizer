import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getPeriodKey, getPeriodEnd } from '@/lib/benefits'
import type { ResetPeriod } from '@/lib/benefits'

export async function GET() {
  const supabase = createServiceClient()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const currentYear = now.getUTCFullYear().toString()

  // 1. Count enrolled offers
  const { count: enrolledOffersCount } = await supabase
    .from('enrolled_offers')
    .select('id', { count: 'exact', head: true })

  // 2. Get enrolled offer IDs (to exclude from expiring panel)
  const { data: enrolledRows } = await supabase
    .from('enrolled_offers')
    .select('offer_id')

  const enrolledIds = (enrolledRows ?? []).map((r) => r.offer_id as string)

  // 3. Get top 20 unenrolled offers expiring within 14 days (fetch extra, filter enrolled client-side)
  const { data: rawExpiring } = await supabase
    .from('amex_offers')
    .select('id, merchant, reward_amount_cents, spend_min_cents, expiration_date, reward_type')
    .eq('active', true)
    .gte('expiration_date', today)
    .lte('expiration_date', in14)
    .order('reward_amount_cents', { ascending: false })
    .limit(20)

  // Filter out already-enrolled
  const enrolledSet = new Set(enrolledIds)
  const expiringOffers = (rawExpiring ?? [])
    .filter((o) => !enrolledSet.has(o.id))
    .slice(0, 10)

  // 4. Count unenrolled offers expiring within 14 days (for stat card)
  let unenrolledExpiringCount = 0
  if (enrolledIds.length === 0) {
    const { count } = await supabase
      .from('amex_offers')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .gte('expiration_date', today)
      .lte('expiration_date', in14)
    unenrolledExpiringCount = count ?? 0
  } else {
    const { count } = await supabase
      .from('amex_offers')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .gte('expiration_date', today)
      .lte('expiration_date', in14)
      .not('id', 'in', `(${enrolledIds.join(',')})`)
    unenrolledExpiringCount = count ?? 0
  }

  // 5. Get enrolled benefits with usage
  const { data: benefits } = await supabase
    .from('amex_benefits')
    .select('*, benefit_usage(*)')
    .eq('active', true)
    .eq('enrolled', true)
    .order('sort_order')

  // 6. Compute per-benefit stats
  const benefitsSummary = (benefits ?? []).map((b) => {
    const period = b.reset_period as ResetPeriod
    const periodKey = getPeriodKey(period, now)
    const periodEnd = getPeriodEnd(period, now)
    const periodUsage = (b.benefit_usage ?? []).filter(
      (u: { period_key: string }) => u.period_key === periodKey
    )
    const usedCents = periodUsage.reduce(
      (sum: number, u: { amount_used_cents: number }) => sum + u.amount_used_cents,
      0
    )
    const remainingCents = Math.max(0, b.amount_cents - usedCents)
    return {
      id: b.id as string,
      name: b.name as string,
      amount_cents: b.amount_cents as number,
      used_cents: usedCents,
      remaining_cents: remainingCents,
      reset_period: period,
      period_ends: periodEnd.toISOString().split('T')[0],
      category: b.category as string,
    }
  })

  benefitsSummary.sort((a, b) => b.remaining_cents - a.remaining_cents)

  // 7. Total benefits remaining this period
  const benefitsRemainingCents = benefitsSummary.reduce((sum, b) => sum + b.remaining_cents, 0)

  // 8. Value captured YTD: benefit usage this year + completed enrolled offers
  // YTD benefit usage: all usage this year regardless of current enrollment state
  // (captures value even from benefits later unenrolled)
  const { data: ytdUsage } = await supabase
    .from('benefit_usage')
    .select('amount_used_cents')
    .like('period_key', `${currentYear}%`)

  const benefitYTDCents = (ytdUsage ?? []).reduce(
    (sum, u) => sum + (u.amount_used_cents as number), 0
  )

  const { data: completedOffers } = await supabase
    .from('enrolled_offers')
    .select('amex_offers(reward_amount_cents)')
    .eq('threshold_met', true)

  const offersYTDCents = (completedOffers ?? []).reduce((sum, row) => {
    const o = row.amex_offers as unknown as { reward_amount_cents: number } | null
    return sum + (o?.reward_amount_cents ?? 0)
  }, 0)

  const valueCapturedYTDCents = benefitYTDCents + offersYTDCents

  return NextResponse.json({
    stats: {
      enrolledOffersCount: enrolledOffersCount ?? 0,
      expiringOffersCount: unenrolledExpiringCount,
      benefitsRemainingCents,
      valueCapturedYTDCents,
    },
    expiringOffers,
    benefitsSummary,
  })
}
