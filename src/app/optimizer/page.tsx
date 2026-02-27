'use client'

import { useState, useEffect, useRef } from 'react'
import type { CardResult, OtherCategory, MatchReason } from '@/lib/optimizer'

const QUICK_PICKS = [
  { key: 'flights', label: 'Flights' },
  { key: 'prepaid_hotels', label: 'Hotels' },
  { key: 'grocery', label: 'Grocery' },
  { key: 'gas', label: 'Gas' },
  { key: 'transit', label: 'Transit' },
  { key: 'rideshare', label: 'Rideshare' },
  { key: 'alaska_airlines', label: 'Alaska Air' },
  { key: 'ev_charging', label: 'EV Charging' },
  { key: 'everything_else', label: 'Everything Else' },
]

function formatRate(rate: number, type: string, currency: string): string {
  if (type === 'multiplier') return `${rate}x ${currency}`
  return `${rate}%`
}

function formatRateShort(rate: number, type: string): string {
  if (type === 'multiplier') return `${rate}x`
  return `${rate}%`
}

function formatCategoryName(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function MatchBadge({ reason, categoryMatched }: { reason: MatchReason; categoryMatched: string }) {
  if (reason === 'alias') return null
  const label =
    reason === 'fuzzy'
      ? `fuzzy → ${formatCategoryName(categoryMatched)}`
      : reason === 'fallback'
        ? 'no match → everything else'
        : `→ ${formatCategoryName(categoryMatched)}`
  const cls =
    reason === 'fallback'
      ? 'text-gray-400'
      : reason === 'fuzzy'
        ? 'text-amber-600'
        : 'text-gray-400'
  return <span className={`text-[11px] ${cls}`}>{label}</span>
}

function CardResultBlock({ result, rank }: { result: CardResult; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const isBest = rank === 0
  const { card, earn_rate, earn_type, category_matched, match_reason, notes, other_categories } = result

  return (
    <div
      className={[
        'border rounded-lg overflow-hidden transition-all',
        isBest
          ? 'border-green-300 shadow-sm'
          : 'border-gray-200 opacity-85',
      ].join(' ')}
    >
      {/* Card header row */}
      <div
        className={[
          'flex items-center justify-between px-4 py-3 gap-4',
          isBest ? 'bg-green-50' : 'bg-gray-50',
        ].join(' ')}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isBest && (
            <span className="shrink-0 text-[10px] font-bold bg-green-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">
              Best
            </span>
          )}
          <span className="text-[15px] font-semibold text-gray-900 truncate">{card.name}</span>
          <MatchBadge reason={match_reason} categoryMatched={category_matched} />
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <span
            className={[
              'font-[var(--font-geist-mono)] text-[18px] font-bold tabular-nums',
              earn_type === 'multiplier' ? 'text-green-700' : 'text-blue-700',
            ].join(' ')}
          >
            {formatRate(earn_rate, earn_type, card.reward_currency)}
          </span>
        </div>
      </div>

      {/* Notes */}
      {notes && (
        <div className="px-4 py-1.5 bg-white border-t border-gray-100">
          <p className="text-[11px] text-gray-500 italic">{notes}</p>
        </div>
      )}

      {/* All other rates breakdown */}
      {other_categories.length > 0 && (
        <div className="bg-white border-t border-gray-100">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>All earn rates ({other_categories.length + 1} categories)</span>
            <span className="text-[10px]">{expanded ? '▲' : '▼'}</span>
          </button>

          {expanded && (
            <div className="border-t border-gray-100">
              {/* Current matched category first */}
              <div className="flex items-center justify-between px-4 py-1.5 bg-green-50/60">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-[12px] font-medium text-gray-700">
                    {formatCategoryName(category_matched)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-[var(--font-geist-mono)] text-[12px] font-semibold text-green-700">
                    {formatRateShort(earn_rate, earn_type)}
                  </span>
                  {notes && <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{notes}</span>}
                </div>
              </div>

              {/* Other categories */}
              {other_categories.map((oc: OtherCategory) => (
                <div
                  key={oc.category_name}
                  className="flex items-center justify-between px-4 py-1.5 border-t border-gray-50 hover:bg-gray-50/50"
                >
                  <span className="text-[12px] text-gray-600">
                    {formatCategoryName(oc.category_name)}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-[var(--font-geist-mono)] text-[12px] text-gray-700 tabular-nums">
                      {formatRateShort(oc.earn_rate, oc.earn_type)}
                    </span>
                    {oc.notes && (
                      <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{oc.notes}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function OptimizerPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CardResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState('')
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function lookup(q: string) {
    const trimmed = q.trim()
    if (!trimmed) { setResults([]); setSearched(''); return }
    setLoading(true)
    setSearched(trimmed)
    setError(null)
    try {
      const res = await fetch(`/api/optimizer?category=${encodeURIComponent(trimmed)}`)
      if (!res.ok) { setResults([]); setError('Failed to load results.'); return }
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => lookup(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <div className="max-w-2xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">Card Optimizer</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">
          Type a merchant or category — see which card earns the most.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <input
          autoFocus
          type="text"
          placeholder="e.g. Whole Foods, Delta, grocery, gas…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (debounceRef.current) clearTimeout(debounceRef.current)
              lookup(query)
            }
          }}
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 focus:ring-0 transition-colors"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">
            …
          </span>
        )}
      </div>

      {/* Quick picks */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {QUICK_PICKS.map((c) => (
          <button
            key={c.key}
            onClick={() => { setQuery(c.label); lookup(c.key) }}
            className={[
              'text-[12px] font-medium px-2.5 py-1 rounded transition-colors',
              query.toLowerCase() === c.label.toLowerCase() || query === c.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-800',
            ].join(' ')}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && <p className="text-[13px] text-red-500 mb-4">{error}</p>}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-[12px] text-gray-400">
            Best card for{' '}
            <span className="font-medium text-gray-700">{searched}</span>
            {results[0].category_matched !== searched.toLowerCase().replace(/ /g, '_') &&
              results[0].match_reason !== 'exact' && (
                <span className="text-gray-400">
                  {' '}· matched as{' '}
                  <span className="text-gray-600">{formatCategoryName(results[0].category_matched)}</span>
                  {results[0].match_reason === 'fuzzy' && (
                    <span className="text-amber-600"> (fuzzy)</span>
                  )}
                </span>
              )}
          </p>
          {results.map((r, i) => (
            <CardResultBlock key={r.card.id} result={r} rank={i} />
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-[13px] text-gray-400">No results for &ldquo;{searched}&rdquo;.</p>
      )}
    </div>
  )
}
