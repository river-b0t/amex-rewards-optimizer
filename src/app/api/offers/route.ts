import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const PAGE_SIZE = 1000

export async function GET(req: NextRequest) {
  const enrolledOnly = req.nextUrl.searchParams.get('enrolled') === 'true'
  const supabase = createServiceClient()

  // Supabase caps responses at 1000 rows — paginate to fetch all
  const allData: Record<string, unknown>[] = []
  let start = 0

  while (true) {
    const { data, error } = await supabase
      .from('amex_offers')
      .select('*, enrolled_offers(*)')
      .eq('active', true)
      .order('reward_amount_cents', { ascending: false })
      .range(start, start + PAGE_SIZE - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    allData.push(...(data ?? []))
    if ((data ?? []).length < PAGE_SIZE) break
    start += PAGE_SIZE
  }

  const offers = allData.map((o) => ({
    ...o,
    is_enrolled: ((o.enrolled_offers as unknown[]) ?? []).length > 0,
    enrollment: ((o.enrolled_offers as unknown[]) ?? [])[0] ?? null,
    enrolled_offers: undefined,
  }))

  const result = enrolledOnly ? offers.filter((o) => o.is_enrolled) : offers
  return NextResponse.json(result)
}
