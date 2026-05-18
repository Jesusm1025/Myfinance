import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

export function StatCard({
  title,
  value,
  icon: Icon,
  tone = 'brand',
}: {
  title: string
  value: string
  icon: LucideIcon
  tone?: 'brand' | 'coral' | 'gold'
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100',
    coral: 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400',
    gold: 'bg-gold-50 text-gold-500 dark:bg-gold-500/15 dark:text-gold-500',
  }

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted dark:text-slate-400">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-normal text-ink dark:text-white">{value}</p>
        </div>
        <div className={clsx('rounded-lg p-2.5', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  )
}
