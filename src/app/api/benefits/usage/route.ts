import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getPeriodKey } from '@/lib/benefits'
import type { ResetPeriod } from '@/lib/benefits'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { benefit_id, amount_used_cents, notes, source = 'manual' } = body

  if (!benefit_id || !amount_used_cents) {
    return NextResponse.json({ error: 'benefit_id and amount_used_cents required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: benefit, error: fetchError } = await supabase
    .from('amex_benefits')
    .select('reset_period')
    .eq('id', benefit_id)
    .single()

  if (fetchError || !benefit) {
    return NextResponse.json({ error: 'Benefit not found' }, { status: 404 })
  }

  const period_key = getPeriodKey(benefit.reset_period as ResetPeriod)

  const { data, error } = await supabase
    .from('benefit_usage')
    .insert({ benefit_id, amount_used_cents, period_key, notes, source })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
