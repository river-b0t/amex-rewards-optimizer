'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

export type Benefit = {
  id: string
  name: string
  description: string
  amount_cents: number
  reset_period: string
  category: string
  enrolled: boolean
  enrollment_required: boolean
  enrollment_url?: string
  current_period_key: string
  used_cents: number
  remaining_cents: number
}

type Props = { benefit: Benefit; onMarkUsed: (id: string, amount: number) => void }

const dollars = (cents: number) => `$${(cents / 100).toFixed(0)}`

const CATEGORY_COLORS: Record<string, string> = {
  travel: 'bg-blue-100 text-blue-800',
  dining: 'bg-orange-100 text-orange-800',
  shopping: 'bg-purple-100 text-purple-800',
  wellness: 'bg-green-100 text-green-800',
  entertainment: 'bg-pink-100 text-pink-800',
  other: 'bg-gray-100 text-gray-800',
}

export function BenefitCard({ benefit, onMarkUsed }: Props) {
  const pct = Math.min(100, Math.round((benefit.used_cents / benefit.amount_cents) * 100))
  const isFullyUsed = benefit.remaining_cents === 0
  const needsEnrollment = !benefit.enrolled && benefit.enrollment_required

  return (
    <Card className={needsEnrollment ? 'border-amber-400 bg-amber-50' : isFullyUsed ? 'border-green-400 bg-green-50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight">{benefit.name}</CardTitle>
          <div className="flex gap-1 shrink-0 flex-wrap justify-end">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[benefit.category] ?? CATEGORY_COLORS.other}`}>
              {benefit.category}
            </span>
            {needsEnrollment && (
              <Badge variant="destructive" className="text-xs">Needs enrollment</Badge>
            )}
            {isFullyUsed && (
              <Badge className="text-xs bg-green-600">Used</Badge>
            )}
          </div>
        </div>
        {benefit.description && (
          <p className="text-xs text-muted-foreground mt-1">{benefit.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-muted-foreground">{dollars(benefit.used_cents)} used</span>
            <span className={benefit.remaining_cents > 0 ? 'text-foreground' : 'text-green-700'}>
              {benefit.remaining_cents > 0 ? `${dollars(benefit.remaining_cents)} left` : 'Fully used ✓'}
            </span>
          </div>
          <Progress value={pct} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {dollars(benefit.amount_cents)} total · resets {benefit.reset_period} · {benefit.current_period_key}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {needsEnrollment ? (
            <Button size="sm" className="text-xs bg-amber-500 hover:bg-amber-600" asChild>
              <a href={benefit.enrollment_url ?? 'https://global.americanexpress.com/card-benefits/view-all'} target="_blank" rel="noopener noreferrer">
                Enroll now →
              </a>
            </Button>
          ) : benefit.enrolled && !isFullyUsed ? (
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => onMarkUsed(benefit.id, benefit.remaining_cents)}
            >
              Mark fully used
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
