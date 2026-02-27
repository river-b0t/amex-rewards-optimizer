import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import type { SyncLogRow } from '@/types/sync'

export type { SyncLogRow }

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
