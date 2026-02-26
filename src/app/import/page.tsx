'use client'

import { useState, useRef } from 'react'
import { Nav } from '@/components/nav'

type BenefitMatch = {
  benefit_id: string
  benefit_name: string
  amount_cents: number
  date: string
  notes: string
  period_key: string
  duplicate: boolean
}

type OfferMatch = {
  enrollment_id: string
  offer_id: string
  merchant: string
  total_spent_cents: number
  spend_min_cents: number
}

type ParseResult = {
  transaction_count: number
  benefit_matches: BenefitMatch[]
  offer_matches: OfferMatch[]
}

type ImportResult = {
  benefits_imported: number
  benefits_skipped: number
  offers_updated: number
}

type Stage = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error'

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

export default function ImportPage() {
  const [stage, setStage] = useState<Stage>('idle')
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    csvRef.current = text
    setStage('parsing')
    try {
      const res = await fetch('/api/transactions/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Parse failed')
      setPreview(data)
      setStage('preview')
    } catch (err) {
      setError(String(err))
      setStage('error')
    }
  }

  async function handleImport() {
    setStage('importing')
    try {
      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvRef.current }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult(data)
      setStage('done')
    } catch (err) {
      setError(String(err))
      setStage('error')
    }
  }

  function reset() {
    setStage('idle')
    csvRef.current = ''
    setPreview(null)
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const newMatches = preview?.benefit_matches.filter((m) => !m.duplicate) ?? []
  const dupMatches = preview?.benefit_matches.filter((m) => m.duplicate) ?? []
  const hasNewContent = newMatches.length > 0 || (preview?.offer_matches.length ?? 0) > 0

  return (
    <>
      <Nav />
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Import Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload your Amex CSV to detect benefit usage and offer progress.
          </p>
        </div>

        {stage === 'idle' && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500 mb-4">Select your Amex CSV file</p>
            <label className="cursor-pointer inline-block bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
              Choose file
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
            <p className="text-xs text-gray-400 mt-3">
              Download from americanexpress.com → Statements → Download CSV
            </p>
          </div>
        )}

        {(stage === 'parsing' || stage === 'importing') && (
          <div className="text-center py-10 text-sm text-gray-500">
            {stage === 'parsing' ? 'Analyzing transactions...' : 'Importing...'}
          </div>
        )}

        {stage === 'preview' && preview && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {preview.transaction_count} transactions scanned
            </p>

            {newMatches.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Benefit matches ({newMatches.length})
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {newMatches.map((m) => (
                    <div key={`${m.benefit_id}-${m.date}-${m.notes}`} className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.benefit_name}</p>
                        <p className="text-xs text-gray-400">{m.date} · {m.notes}</p>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{dollars(m.amount_cents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dupMatches.length > 0 && (
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    Already imported — will skip ({dupMatches.length})
                  </span>
                </div>
                <div className="divide-y divide-amber-100">
                  {dupMatches.map((m) => (
                    <div key={`${m.benefit_id}-${m.date}-${m.notes}`} className="px-4 py-3 flex justify-between items-center opacity-60">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.benefit_name}</p>
                        <p className="text-xs text-gray-400">{m.date} · {m.notes}</p>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{dollars(m.amount_cents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.offer_matches.length > 0 && (
              <div className="border border-green-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-green-50 border-b border-green-200">
                  <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                    Offer thresholds met ({preview.offer_matches.length})
                  </span>
                </div>
                <div className="divide-y divide-green-100">
                  {preview.offer_matches.map((m) => (
                    <div key={m.enrollment_id} className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.merchant}</p>
                        <p className="text-xs text-gray-400">
                          Spent {dollars(m.total_spent_cents)} · min {dollars(m.spend_min_cents)}
                        </p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Threshold met
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasNewContent && (
              <div className="text-center py-6 text-sm text-gray-400">
                No new matches found in this CSV.
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleImport}
                disabled={!hasNewContent}
                className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                Confirm import
              </button>
              <button
                onClick={reset}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {stage === 'done' && result && (
          <div className="space-y-4">
            <div className="border border-green-200 bg-green-50 rounded-xl p-6 text-center">
              <p className="text-base font-semibold text-green-800">Import complete</p>
              <p className="text-sm text-green-700 mt-1">
                {result.benefits_imported} benefit {result.benefits_imported === 1 ? 'usage' : 'usages'} recorded
                {result.benefits_skipped > 0 && `, ${result.benefits_skipped} skipped`}
                {result.offers_updated > 0 &&
                  ` · ${result.offers_updated} offer${result.offers_updated === 1 ? '' : 's'} marked complete`}
              </p>
            </div>
            <div className="flex gap-4">
              <a href="/benefits" className="text-sm font-medium text-gray-900 underline underline-offset-2">
                View benefits
              </a>
              <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">
                Import another
              </button>
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={reset} className="ml-4 underline underline-offset-2 whitespace-nowrap">
              Try again
            </button>
          </div>
        )}
      </div>
    </>
  )
}
