import Link from 'next/link'
import { ResetReminderBanner } from '@/components/dashboard/ResetReminderBanner'

async function getBenefits() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/benefits`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

export default async function DashboardPage() {
  const benefits = await getBenefits()

  const unenrolled = benefits.filter(
    (b: { enrolled: boolean; enrollment_required: boolean }) => !b.enrolled && b.enrollment_required
  )
  const unenrolledValueCents = unenrolled.reduce(
    (sum: number, b: { amount_cents: number }) => sum + b.amount_cents, 0
  )

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Amex Platinum rewards at a glance</p>
      </div>

      <ResetReminderBanner benefits={benefits} />

      {unenrolled.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-2">
          <p className="font-semibold text-amber-800">
            You&apos;re leaving ${(unenrolledValueCents / 100).toFixed(0)}/year on the table
          </p>
          <ul className="space-y-1">
            {unenrolled.map((b: { id: string; name: string; amount_cents: number }) => (
              <li key={b.id} className="text-sm text-amber-700 flex items-center justify-between">
                <span>{b.name}</span>
                <span className="font-medium">${(b.amount_cents / 100).toFixed(0)}/yr</span>
              </li>
            ))}
          </ul>
          <Link href="/benefits" className="inline-block text-sm text-amber-900 font-medium underline underline-offset-2 mt-1">
            View all benefits →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/optimizer" className="block p-5 border rounded-lg hover:bg-slate-50 transition-colors">
          <h2 className="font-semibold text-sm">Card Optimizer</h2>
          <p className="text-xs text-muted-foreground mt-1">Which card earns best for any purchase</p>
        </Link>
        <Link href="/benefits" className="block p-5 border rounded-lg hover:bg-slate-50 transition-colors">
          <h2 className="font-semibold text-sm">Benefits Tracker</h2>
          <p className="text-xs text-muted-foreground mt-1">Track credits used and remaining</p>
        </Link>
        <Link href="/offers" className="block p-5 border rounded-lg hover:bg-slate-50 transition-colors">
          <h2 className="font-semibold text-sm">Amex Offers</h2>
          <p className="text-xs text-muted-foreground mt-1">Browse and track enrolled offers</p>
        </Link>
      </div>
    </div>
  )
}
