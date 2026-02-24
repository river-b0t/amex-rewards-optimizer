import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { benefit_id } = await req.json()
  if (!benefit_id) return NextResponse.json({ error: 'benefit_id required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: current, error: fetchError } = await supabase
    .from('amex_benefits')
    .select('enrolled')
    .eq('id', benefit_id)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Benefit not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('amex_benefits')
    .update({ enrolled: !current.enrolled })
    .eq('id', benefit_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ enrolled: !current.enrolled })
}
