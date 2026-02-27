export type SyncLogRow = {
  id: string
  type: 'offers_scrape' | 'budget_sync'
  ran_at: string
  records_processed: number
  records_updated: number | null
  error: string | null
}
