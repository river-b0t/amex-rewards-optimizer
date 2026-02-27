import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export type SyncLogRow = {
  id: string
  type: 'offers_scrape' | 'budget_sync'
  ran_at: string
  records_processed: number
  records_updated: number | null
  error: string | null
}

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sync_log')
    .select('id, type, ran_at, records_processed, records_updated, error')
    .order('ran_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ rows: [] })
  return NextResponse.json({ rows: data ?? [] })
}
