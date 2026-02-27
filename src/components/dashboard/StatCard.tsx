export function StatCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string
  value: string
  subtext?: string
  accent?: 'green' | 'amber' | 'blue' | 'red' | 'default'
}) {
  const accentColor = {
    green: 'border-l-green-500',
    amber: 'border-l-amber-500',
    blue: 'border-l-blue-500',
    red: 'border-l-red-500',
    default: 'border-l-gray-300',
  }[accent ?? 'default']

  return (
    <div className={`border border-gray-200 rounded-lg p-4 border-l-4 ${accentColor} bg-white`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.8px] text-gray-400">{label}</p>
      <p className="text-[24px] font-bold text-gray-900 mt-1 tabular-nums leading-none">{value}</p>
      {subtext && <p className="text-[12px] text-gray-400 mt-1">{subtext}</p>}
    </div>
  )
}
