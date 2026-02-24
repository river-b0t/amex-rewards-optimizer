import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { offer_id } = await req.json()
  if (!offer_id) return NextResponse.json({ error: 'offer_id required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('enrolled_offers')
    .select('id')
    .eq('offer_id', offer_id)
    .maybeSingle()

  if (existing) {
    await supabase.from('enrolled_offers').delete().eq('id', existing.id)
    return NextResponse.json({ enrolled: false })
  }

  const { data, error } = await supabase
    .from('enrolled_offers')
    .insert({ offer_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ enrolled: true, enrollment: data })
}
