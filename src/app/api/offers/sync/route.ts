import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { scrapeFrequentMilerOffers } from '@/lib/scraper'

// Vercel cron sends GET requests; also support POST for manual triggers
export async function GET(req: NextRequest) {
  return handleSync(req)
}

export async function POST(req: NextRequest) {
  return handleSync(req)
}

async function handleSync(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const offers = await scrapeFrequentMilerOffers()

    if (offers.length === 0) {
      return NextResponse.json(
        { synced: 0, message: 'No offers scraped', timestamp: new Date().toISOString() },
        { status: 200 }
      )
    }

    const supabase = createServiceClient()

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
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Mark offers past their expiration date as inactive
    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('amex_offers')
      .update({ active: false })
      .lt('expiration_date', today)

    return NextResponse.json({
      synced: offers.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[sync] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
