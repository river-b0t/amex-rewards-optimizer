import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('amex_offers')
    .select('scraped_at')
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return NextResponse.json({ lastSyncedAt: null })

  return NextResponse.json({ lastSyncedAt: data?.scraped_at ?? null })
}
