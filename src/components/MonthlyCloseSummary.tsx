import { ArrowDownCircle, ArrowUpCircle, Scale, TrendingUp } from 'lucide-react'
import clsx from 'clsx'
import { StatCard } from './StatCard'
import type { MonthlyCloseCategory, MonthlyCloseSummary as MonthlyCloseSummaryData } from '../utils/monthlyClose'
import { formatMoney } from '../utils/format'

function formatPercent(value: number | null) {
  if (value === null) return 'Nuevo'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function ComparisonPill({ label, value, positiveIsGood = true }: { label: string; value: number | null; positiveIsGood?: boolean }) {
  const isPositive = value === null ? true : value >= 0
  const isGood = positiveIsGood ? isPositive : !isPositive

  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
      <p className="text-xs text-muted dark:text-slate-400">{label}</p>
      <p
        className={clsx(
          'mt-1 font-semibold',
          isGood ? 'text-brand-700 dark:text-brand-100' : 'text-coral-600 dark:text-coral-400',
        )}
      >
        {formatPercent(value)}
      </p>
    </div>
  )
}

export function MonthlyCloseSummary({
  summary,
  topCategories,
}: {
  summary: MonthlyCloseSummaryData
  topCategories: MonthlyCloseCategory[]
}) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Ingresos del mes" value={formatMoney(summary.income)} icon={ArrowUpCircle} />
        <StatCard title="Gastos del mes" value={formatMoney(summary.expenses)} icon={ArrowDownCircle} tone="coral" />
        <StatCard title="Balance neto" value={formatMoney(summary.balance)} icon={Scale} tone="gold" />
        <StatCard title="Cambio vs mes anterior" value={formatMoney(summary.balanceChange)} icon={TrendingUp} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h3 className="font-semibold text-ink dark:text-white">Comparacion con el mes anterior</h3>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <ComparisonPill label="Ingresos" value={summary.incomeChangePercent} />
            <ComparisonPill label="Gastos" value={summary.expensesChangePercent} positiveIsGood={false} />
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
              <p className="text-xs text-muted dark:text-slate-400">Balance previo</p>
              <p className="mt-1 truncate font-semibold text-ink dark:text-white">{formatMoney(summary.previousBalance)}</p>
            </div>
          </div>
        </article>

        <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h3 className="font-semibold text-ink dark:text-white">Categorias donde mas gastaste</h3>
          {topCategories.length ? (
            <div className="mt-4 space-y-3">
              {topCategories.map((category) => (
                <div key={category.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                      <span className="truncate font-medium text-ink dark:text-white">{category.name}</span>
                    </div>
                    <span className="shrink-0 font-semibold text-coral-600 dark:text-coral-400">
                      {formatMoney(category.amount)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-coral-500"
                      style={{ width: `${Math.min(category.percentOfExpenses, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted dark:text-slate-400">No hay gastos en el mes seleccionado.</p>
          )}
        </article>
      </section>
    </div>
  )
}
