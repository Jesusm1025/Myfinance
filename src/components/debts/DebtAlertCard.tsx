import type { LucideIcon } from 'lucide-react'
import type { Debt } from '../../types/finance'
import { formatDate, formatMoney } from '../../utils/format'

export function DebtAlertCard({
  icon: Icon,
  title,
  tone,
  debts,
  emptyText,
}: {
  icon: LucideIcon
  title: string
  tone: 'danger' | 'warning'
  debts: Debt[]
  emptyText: string
}) {
  const tones = {
    danger: 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400',
    warning: 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400',
  }

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted dark:text-slate-400">{debts.length} deuda(s)</p>
        </div>
      </div>
      {debts.length ? (
        <div className="mt-4 space-y-2">
          {debts.slice(0, 3).map((debt) => (
            <div key={debt.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink dark:text-white">{debt.name}</p>
                  <p className="text-xs text-muted dark:text-slate-400">
                    {debt.due_date ? formatDate(debt.due_date) : 'Sin fecha'}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">{formatMoney(Number(debt.outstanding_balance))}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted dark:text-slate-400">{emptyText}</p>
      )}
    </article>
  )
}
