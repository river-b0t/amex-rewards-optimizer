import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getPeriodKey } from '@/lib/benefits'
import type { ResetPeriod } from '@/lib/benefits'

export async function GET() {
  const supabase = createServiceClient()

  const { data: benefits, error } = await supabase
    .from('amex_benefits')
    .select('*, benefit_usage(*)')
    .eq('active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = new Date()
  const annotated = (benefits ?? []).map((b) => {
    const periodKey = getPeriodKey(b.reset_period as ResetPeriod, now)
    const periodUsage = (b.benefit_usage ?? []).filter(
      (u: { period_key: string }) => u.period_key === periodKey
    )
    const usedCents = periodUsage.reduce(
      (sum: number, u: { amount_used_cents: number }) => sum + u.amount_used_cents,
      0
    )
    return {
      ...b,
      benefit_usage: undefined,
      current_period_key: periodKey,
      used_cents: usedCents,
      remaining_cents: Math.max(0, b.amount_cents - usedCents),
    }
  })

  return NextResponse.json(annotated)
}
