import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { scrapeFrequentMilerOffers } from '@/lib/scraper'

export async function POST() {
  try {
    const offers = await scrapeFrequentMilerOffers()
    const supabase = createServiceClient()

    if (offers.length === 0) {
      await supabase.from('sync_log').insert({
        type: 'offers_scrape',
        records_processed: 0,
        error: 'No offers scraped',
      })
      return NextResponse.json(
        { synced: 0, message: 'No offers scraped', timestamp: new Date().toISOString() },
        { status: 200 }
      )
    }

    const { error: upsertError } = await supabase.from('amex_offers').upsert(
      offers.map((o) => ({
        ...o,
        active: true,
        scraped_at: new Date().toISOString(),
      })),
      {
        onConflict: 'merchant,expiration_date,reward_amount_cents',
        ignoreDuplicates: false,
      }
    )

    if (upsertError) {
      try {
        await supabase.from('sync_log').insert({
          type: 'offers_scrape',
          records_processed: offers.length,
          error: upsertError.message,
        })
      } catch { /* ignore */ }
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('amex_offers')
      .update({ active: false })
      .lt('expiration_date', today)

    await supabase.from('sync_log').insert({
      type: 'offers_scrape',
      records_processed: offers.length,
      error: null,
    })

    return NextResponse.json({
      synced: offers.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[sync-now] error:', err)
    try {
      const supabase = createServiceClient()
      await supabase.from('sync_log').insert({
        type: 'offers_scrape',
        records_processed: 0,
        error: String(err),
      })
    } catch { /* ignore */ }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
