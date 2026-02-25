import { StatCard } from '@/components/dashboard/StatCard'
import { ExpiringOffersPanel } from '@/components/dashboard/ExpiringOffersPanel'
import { BenefitsSummaryPanel } from '@/components/dashboard/BenefitsSummaryPanel'

async function getDashboardData() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/dashboard`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch dashboard data')
  return res.json()
}

function formatDollars(cents: number): string {
  if (cents >= 100000) return `$${(cents / 100000).toFixed(1)}k`
  return `$${Math.round(cents / 100).toLocaleString()}`
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const { stats, expiringOffers, enrolledExpiringOffers, benefitsSummary } = data

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Amex Platinum — rewards at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Enrolled Offers"
          value={stats.enrolledOffersCount.toString()}
          accent="blue"
        />
        <StatCard
          label="Expiring Soon"
          value={stats.expiringOffersCount.toString()}
          subtext="unenrolled, 14d"
          accent={stats.expiringOffersCount > 0 ? 'amber' : 'default'}
        />
        <StatCard
          label="Benefits Remaining"
          value={formatDollars(stats.benefitsRemainingCents)}
          subtext="this period"
          accent="green"
        />
        <StatCard
          label="Value Captured YTD"
          value={formatDollars(stats.valueCapturedYTDCents)}
          accent="default"
        />
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExpiringOffersPanel
          unenrolledOffers={expiringOffers}
          enrolledOffers={enrolledExpiringOffers ?? []}
        />
        <BenefitsSummaryPanel benefits={benefitsSummary} />
      </div>
    </div>
  )
}
