import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const enrolledOnly = req.nextUrl.searchParams.get('enrolled') === 'true'
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('amex_offers')
    .select('*, enrolled_offers(*)')
    .eq('active', true)
    .order('reward_amount_cents', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const offers = (data ?? []).map((o) => ({
    ...o,
    is_enrolled: (o.enrolled_offers ?? []).length > 0,
    enrollment: (o.enrolled_offers ?? [])[0] ?? null,
    enrolled_offers: undefined,
  }))

  const result = enrolledOnly ? offers.filter((o) => o.is_enrolled) : offers
  return NextResponse.json(result)
}
