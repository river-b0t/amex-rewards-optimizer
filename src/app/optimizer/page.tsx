'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CardResult, OtherCategory } from '@/lib/optimizer'

const CATEGORIES = [
  { key: 'flights', label: 'Flights' },
  { key: 'prepaid_hotels', label: 'Prepaid Hotels' },
  { key: 'grocery', label: 'Grocery' },
  { key: 'gas', label: 'Gas' },
  { key: 'transit', label: 'Transit' },
  { key: 'rideshare', label: 'Rideshare' },
  { key: 'alaska_airlines', label: 'Alaska Airlines' },
  { key: 'everything_else', label: 'Everything Else' },
]

export default function OptimizerPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CardResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState('')

  async function lookup(category: string) {
    if (!category.trim()) return
    setLoading(true)
    setSearched(category)
    const res = await fetch(`/api/optimizer?category=${encodeURIComponent(category.trim())}`)
    const data = await res.json()
    setResults(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const formatEarning = (r: CardResult) => {
    if (r.earn_type === 'multiplier') return `${r.earn_rate}x ${r.card.reward_currency}`
    return `${r.earn_rate}% cashback`
  }

  const formatOther = (oc: OtherCategory) => {
    if (oc.earn_type === 'multiplier') return `${oc.earn_rate}x`
    return `${oc.earn_rate}%`
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Card Optimizer</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Which card earns the most for a given purchase?
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="e.g. grocery, flights, gas..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookup(query)}
        />
        <Button onClick={() => lookup(query)} disabled={loading}>
          {loading ? 'Looking up...' : 'Look up'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Button
            key={c.key}
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => { setQuery(c.key); lookup(c.key) }}
          >
            {c.label}
          </Button>
        ))}
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Best card for <span className="font-medium text-foreground">{searched}</span>:
          </p>
          {results.map((r, i) => (
            <Card
              key={r.card.id}
              className={i === 0 ? 'border-2 border-green-400 bg-green-50' : 'opacity-75'}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{r.card.name}</p>
                    {i === 0 && <Badge className="text-xs bg-green-600">Best</Badge>}
                  </div>
                  <Badge
                    variant={i === 0 ? 'default' : 'outline'}
                    className="text-sm shrink-0"
                  >
                    {formatEarning(r)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  matched: {r.category_matched.replace(/_/g, ' ')}
                  {r.notes && ` · ${r.notes}`}
                </p>
                {r.other_categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.other_categories.map((oc) => (
                      <span
                        key={oc.category_name}
                        className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
                      >
                        {oc.category_name.replace(/_/g, ' ')}: {formatOther(oc)}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
