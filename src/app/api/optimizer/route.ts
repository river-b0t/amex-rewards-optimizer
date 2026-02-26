import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCardResults } from '@/lib/optimizer'

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')
  if (!category) {
    return NextResponse.json({ error: 'category query param required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: cards, error } = await supabase
    .from('cards')
    .select('*, card_categories(*)')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ranked = getCardResults(category, cards ?? [])
  return NextResponse.json(ranked)
}
