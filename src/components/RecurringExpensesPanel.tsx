import { CalendarClock, Repeat2 } from 'lucide-react'
import clsx from 'clsx'
import type { RecurringExpense } from '../utils/recurringExpenses'
import { formatDate, formatMoney } from '../utils/format'

const confidenceLabels = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

const confidenceStyles = {
  high: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100',
  medium: 'bg-gold-50 text-gold-700 dark:bg-gold-500/15 dark:text-gold-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

export function RecurringExpensesPanel({
  items,
  totalMonthlyEstimate,
  compact = false,
  maxItems,
}: {
  items: RecurringExpense[]
  totalMonthlyEstimate: number
  compact?: boolean
  maxItems?: number
}) {
  const visibleItems = typeof maxItems === 'number' ? items.slice(0, maxItems) : items

  if (!visibleItems.length) {
    return (
      <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
            <Repeat2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink dark:text-white">Gastos recurrentes</h3>
            <p className="text-sm text-muted dark:text-slate-400">
              Aun no hay suficientes patrones mensuales para detectar recurrencias.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
            <Repeat2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink dark:text-white">Gastos recurrentes</h3>
            <p className="text-sm text-muted dark:text-slate-400">
              Patrones mensuales detectados en tus movimientos.
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
          <span className="text-muted dark:text-slate-400">Estimado mensual</span>
          <p className="font-semibold text-coral-600 dark:text-coral-400">{formatMoney(totalMonthlyEstimate)}</p>
        </div>
      </div>

      <div className={clsx('grid gap-3', compact ? 'xl:grid-cols-2' : 'lg:grid-cols-2 xl:grid-cols-3')}>
        {visibleItems.map((item) => (
          <article key={item.id} className="rounded-lg border border-line p-3 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-1 h-10 w-10 shrink-0 rounded-lg" style={{ backgroundColor: item.categoryColor }} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink dark:text-white">{item.name}</p>
                  <p className="text-sm text-muted dark:text-slate-400">{item.categoryName}</p>
                </div>
              </div>
              <span
                className={clsx(
                  'shrink-0 rounded-full px-2 py-1 text-xs font-semibold',
                  confidenceStyles[item.confidence],
                )}
              >
                {confidenceLabels[item.confidence]}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Metric label="Promedio" value={formatMoney(item.averageAmount)} tone="expense" />
              <Metric label="Ultimo monto" value={formatMoney(item.lastAmount)} />
              <Metric label="Meses" value={String(item.months)} />
              <Metric label="Veces" value={String(item.occurrences)} />
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              <CalendarClock className="h-4 w-4 shrink-0" />
              <span>Proximo estimado: {formatDate(item.nextExpectedDate)}</span>
            </div>
          </article>
        ))}
      </div>

      {typeof maxItems === 'number' && items.length > visibleItems.length ? (
        <p className="mt-3 text-sm text-muted dark:text-slate-400">
          Hay {items.length - visibleItems.length} gasto{items.length - visibleItems.length === 1 ? '' : 's'} recurrente{items.length - visibleItems.length === 1 ? '' : 's'} adicional{items.length - visibleItems.length === 1 ? '' : 'es'} en reportes.
        </p>
      ) : null}
    </section>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'expense' }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
      <p className="text-xs text-muted dark:text-slate-400">{label}</p>
      <p className={clsx('mt-1 truncate font-semibold', tone === 'expense' ? 'text-coral-600 dark:text-coral-400' : 'text-ink dark:text-white')}>
        {value}
      </p>
    </div>
  )
}
