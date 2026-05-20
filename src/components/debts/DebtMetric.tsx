export function DebtMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted dark:text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold text-ink dark:text-white">{value}</dd>
    </div>
  )
}
