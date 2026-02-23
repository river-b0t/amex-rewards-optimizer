'use client'

import { isExpiringSoon } from '@/lib/benefits'
import type { ResetPeriod } from '@/lib/benefits'

type Benefit = {
  id: string
  name: string
  remaining_cents: number
  reset_period: string
}

export function ResetReminderBanner({ benefits }: { benefits: Benefit[] }) {
  const now = new Date()
  const expiring = benefits.filter(
    (b) => b.remaining_cents > 0 && isExpiringSoon(b.reset_period as ResetPeriod, now)
  )

  if (expiring.length === 0) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <p className="font-semibold text-blue-800 text-sm mb-2">Use before reset:</p>
      <ul className="space-y-1">
        {expiring.map((b) => (
          <li key={b.id} className="text-sm text-blue-700 flex items-center justify-between">
            <span>{b.name}</span>
            <span className="font-medium">${(b.remaining_cents / 100).toFixed(0)} remaining</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
