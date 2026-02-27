'use client'

import { useState } from 'react'
import type { SyncLogRow } from '@/types/sync'

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

function typeLabel(type: string): string {
  return type === 'offers_scrape' ? 'Offers scrape' : 'Budget sync'
}

function recordSummary(row: SyncLogRow): string {
  if (row.error) return row.error.length > 40 ? row.error.slice(0, 40) + '…' : row.error
  if (row.type === 'offers_scrape') return `${row.records_processed} offers`
  const updated = row.records_updated ?? 0
  return `${row.records_processed} txns · ${updated} updated`
}

export function SyncHistoryPanel({ rows }: { rows: SyncLogRow[] }) {
  const [expanded, setExpanded] = useState(false)

  // Last run per type for summary view
  const lastOffersScrape = rows.find((r) => r.type === 'offers_scrape')
  const lastBudgetSync = rows.find((r) => r.type === 'budget_sync')
  const summaryRows = [lastOffersScrape, lastBudgetSync].filter(Boolean) as SyncLogRow[]

  const displayRows = expanded ? rows.slice(0, 10) : summaryRows

  if (rows.length === 0) return null

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] border-b border-gray-200">
        <h2 className="text-[13px] font-semibold text-gray-700">Sync History</h2>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? 'Show less' : 'Show history'}
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {displayRows.map((row) => (
          <div key={row.id} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span
                className={[
                  'w-[6px] h-[6px] rounded-full shrink-0',
                  row.error ? 'bg-red-400' : 'bg-green-500',
                ].join(' ')}
              />
              <span className="text-[13px] text-gray-700">{typeLabel(row.type)}</span>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={`text-[12px] ${row.error ? 'text-red-500' : 'text-gray-400'}`}
              >
                {recordSummary(row)}
              </span>
              <span className="text-[12px] text-gray-400 tabular-nums w-[52px] text-right">
                {formatRelativeTime(row.ran_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
