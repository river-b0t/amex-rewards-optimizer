import Link from 'next/link'

type BenefitSummary = {
  id: string
  name: string
  amount_cents: number
  used_cents: number
  remaining_cents: number
  reset_period: string
  period_ends: string
  category: string
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`
}

const CATEGORY_COLORS: Record<string, string> = {
  travel: 'bg-blue-100 text-blue-700',
  dining: 'bg-orange-100 text-orange-700',
  shopping: 'bg-purple-100 text-purple-700',
  wellness: 'bg-green-100 text-green-700',
  entertainment: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
}

export function BenefitsSummaryPanel({ benefits }: { benefits: BenefitSummary[] }) {
  if (benefits.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-[14px] font-semibold text-gray-900 mb-4">Benefits This Period</h2>
        <p className="text-[13px] text-gray-400">No enrolled benefits. Go to Benefits to enroll.</p>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-[#fafafa]">
        <h2 className="text-[14px] font-semibold text-gray-900">Benefits This Period</h2>
        <span className="text-[11px] text-gray-400">Enrolled only</span>
      </div>

      {/* Rows */}
      {benefits.map((b) => {
        const pct = b.amount_cents > 0 ? Math.min(100, Math.round((b.used_cents / b.amount_cents) * 100)) : 0
        const daysLeft = daysUntil(b.period_ends)
        const catColor = CATEGORY_COLORS[b.category] ?? CATEGORY_COLORS.other
        const isFullyUsed = b.remaining_cents === 0

        return (
          <div key={b.id} className="px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/40 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${catColor}`}>
                  {b.category}
                </span>
                <p className="text-[13px] font-semibold text-gray-900 truncate">{b.name}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className={`text-[13px] font-bold tabular-nums ${isFullyUsed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {formatDollars(b.remaining_cents)}
                </span>
                <span className="text-[11px] text-gray-400"> left</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all ${isFullyUsed ? 'bg-gray-300' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400">{pct}% used</span>
              <span className={`text-[11px] ${daysLeft <= 7 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                {daysLeft}d left in period
              </span>
            </div>
          </div>
        )
      })}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-[#fafafa]">
        <Link href="/benefits" className="text-[12px] text-blue-600 hover:text-blue-800 font-medium">
          Manage benefits →
        </Link>
      </div>
    </div>
  )
}
