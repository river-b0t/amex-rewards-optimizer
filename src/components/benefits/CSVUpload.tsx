'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function CSVUpload({ onImported }: { onImported: (count: number) => void }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; matches: { benefit_name: string; amount: number; date: string }[] } | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    const csv = await file.text()
    const res = await fetch('/api/benefits/csv-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv }),
    })
    const data = await res.json()
    setResult(data)
    setLoading(false)
    if (data.imported > 0) {
      onImported(data.imported)
      setTimeout(() => window.location.reload(), 1500) // short delay so user sees the result
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label>
          <Button size="sm" variant="outline" asChild>
            <span>{loading ? 'Importing...' : 'Upload Amex CSV'}</span>
          </Button>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFile}
            disabled={loading}
          />
        </label>
        <p className="text-xs text-muted-foreground">Auto-matches statement credits to benefits</p>
      </div>

      {result && (
        <div className="text-sm border rounded-lg p-3 bg-slate-50">
          {result.imported === 0 ? (
            <p className="text-muted-foreground">No benefit credits found in this CSV.</p>
          ) : (
            <>
              <p className="font-medium text-green-700">{result.imported} credit{result.imported !== 1 ? 's' : ''} imported</p>
              <ul className="mt-1 space-y-0.5">
                {result.matches.map((m, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {m.benefit_name} &mdash; ${m.amount.toFixed(2)} on {m.date}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
