'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

export function BudgetSyncButton({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const router = useRouter()

  async function handleSync() {
    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch('/api/transactions/budget-sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResult(`Error: ${data.error}`)
      } else {
        setResult(`Synced: ${data.offers_updated} offers · ${data.benefits_synced} benefits`)
        router.refresh()
      }
    } catch {
      setResult('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-[12px] text-gray-500">{result}</span>
      )}
      {!result && lastSyncedAt && (
        <span className="text-[12px] text-gray-400">
          synced {formatRelativeTime(lastSyncedAt)}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="text-[12px] font-medium border border-gray-200 rounded px-3 py-1.5 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-40"
      >
        {syncing ? 'Syncing…' : 'Sync transactions'}
      </button>
    </div>
  )
}
