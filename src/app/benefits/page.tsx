import { BenefitCard } from '@/components/benefits/BenefitCard'
import type { Benefit } from '@/components/benefits/BenefitCard'
import { CSVUpload } from '@/components/benefits/CSVUpload'

async function getBenefits(): Promise<Benefit[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/benefits`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

export default async function BenefitsPage() {
  const benefits = await getBenefits()

  const enrolled = benefits.filter((b) => b.enrolled)
  const unenrolled = benefits.filter((b) => !b.enrolled && b.enrollment_required)

  const totalRemainingCents = enrolled.reduce((sum, b) => sum + b.remaining_cents, 0)
  const unenrolledValueCents = unenrolled.reduce((sum, b) => sum + b.amount_cents, 0)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Benefits Tracker</h1>
        <p className="text-muted-foreground mt-1">
          <span className="font-medium text-foreground">${(totalRemainingCents / 100).toFixed(0)}</span> remaining in enrolled credits
          {unenrolledValueCents > 0 && (
            <> · <span className="text-amber-600 font-medium">${(unenrolledValueCents / 100).toFixed(0)}/yr left on the table</span></>
          )}
        </p>
        <div className="mt-4">
          <CSVUpload />
        </div>
      </div>

      {unenrolled.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-amber-700">⚠ Needs Enrollment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unenrolled.map((b) => (
              <BenefitCard key={b.id} benefit={b} onMarkUsed={() => {}} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Active Benefits</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enrolled.map((b) => (
            <BenefitCard key={b.id} benefit={b} onMarkUsed={() => {}} />
          ))}
        </div>
      </section>
    </div>
  )
}
