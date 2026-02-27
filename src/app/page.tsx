import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { getPeriodKey, getPeriodEnd } from '@/lib/benefits'
import type { ResetPeriod } from '@/lib/benefits'
import { StatCard } from '@/components/dashboard/StatCard'
import { ExpiringOffersPanel } from '@/components/dashboard/ExpiringOffersPanel'
import { BenefitsSummaryPanel } from '@/components/dashboard/BenefitsSummaryPanel'

export const metadata: Metadata = { title: 'Dashboard' }

function formatDollars(cents: number): string {
  if (cents >= 100000) return `$${(cents / 100000).toFixed(1)}k`
  return `$${Math.round(cents / 100).toLocaleString()}`
}

export default async function DashboardPage() {
  const supabase = createServiceClient()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const currentYear = now.getUTCFullYear().toString()

  const { count: enrolledOffersCount } = await supabase
    .from('enrolled_offers')
    .select('id', { count: 'exact', head: true })

  const { data: enrolledRows } = await supabase
    .from('enrolled_offers')
    .select('offer_id')

  const enrolledIds = (enrolledRows ?? []).map((r) => r.offer_id as string)
  const enrolledSet = new Set(enrolledIds)

  const { data: rawExpiring } = await supabase
    .from('amex_offers')
    .select('id, merchant, reward_amount_cents, spend_min_cents, expiration_date, reward_type')
    .eq('active', true)
    .gte('expiration_date', today)
    .lte('expiration_date', in14)
    .order('reward_amount_cents', { ascending: false })
    .limit(20)

  const expiringOffers = (rawExpiring ?? [])
    .filter((o) => !enrolledSet.has(o.id))
    .slice(0, 10)

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

  const { data: rawEnrolledExpiring } = await supabase
    .from('enrolled_offers')
    .select('id, amex_offers!inner(merchant, reward_amount_cents, spend_min_cents, expiration_date, reward_type)')
    .eq('threshold_met', false)
    .gte('amex_offers.expiration_date', today)
    .lte('amex_offers.expiration_date', in30)
    .order('amex_offers.expiration_date', { ascending: true })

  const enrolledExpiringOffers = (rawEnrolledExpiring ?? []).map((row) => {
    const o = Array.isArray(row.amex_offers) ? row.amex_offers[0] : row.amex_offers
    return {
      id: row.id as string,
      merchant: (o as { merchant: string }).merchant,
      reward_amount_cents: (o as { reward_amount_cents: number | null }).reward_amount_cents,
      spend_min_cents: (o as { spend_min_cents: number | null }).spend_min_cents,
      expiration_date: (o as { expiration_date: string }).expiration_date,
      reward_type: (o as { reward_type: string }).reward_type,
    }
  })

  const { data: benefits } = await supabase
    .from('amex_benefits')
    .select('*, benefit_usage(*)')
    .eq('active', true)
    .eq('enrolled', true)
    .order('sort_order')

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

  const benefitsRemainingCents = benefitsSummary.reduce((sum, b) => sum + b.remaining_cents, 0)

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
    const raw = row.amex_offers
    const o = Array.isArray(raw) ? raw[0] : raw
    return sum + ((o as { reward_amount_cents?: number } | null)?.reward_amount_cents ?? 0)
  }, 0)

  const valueCapturedYTDCents = benefitYTDCents + offersYTDCents

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Amex Platinum — rewards at a glance</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Enrolled Offers" value={(enrolledOffersCount ?? 0).toString()}
  accent="blue" />
        <StatCard label="Expiring in 14d" value={unenrolledExpiringCount.toString()}
  subtext="unenrolled" accent={unenrolledExpiringCount > 0 ? 'amber' : 'default'} />
        <StatCard label="Benefits Remaining" value={formatDollars(benefitsRemainingCents)}
  subtext="this period" accent="green" />
        <StatCard label="Value Captured YTD" value={formatDollars(valueCapturedYTDCents)}
  accent="default" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExpiringOffersPanel unenrolledOffers={expiringOffers} enrolledOffers={enrolledExpiringOffers} />
        <BenefitsSummaryPanel benefits={benefitsSummary} />
      </div>
    </div>
  )
}
