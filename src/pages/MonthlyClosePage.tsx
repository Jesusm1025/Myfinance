import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarCheck, CheckCircle2, Clock, PiggyBank, TriangleAlert } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { MonthlyCloseRecommendations } from '../components/MonthlyCloseRecommendations'
import { MonthlyCloseSummary } from '../components/MonthlyCloseSummary'
import { RecurringExpensesPanel } from '../components/RecurringExpensesPanel'
import { SkeletonList, SkeletonStats } from '../components/Skeleton'
import { StatusMessage } from '../components/StatusMessage'
import { budgetsChangedEvent, categoriesChangedEvent, debtsChangedEvent, movementsChangedEvent } from '../events/financeEvents'
import {
  listAllMovements,
  listCategories,
  listDebtInstallments,
  listDebtPayments,
  listDebts,
  listMonthlyBudgets,
  listMovements,
} from '../services/accounting'
import type { Category, Debt, DebtInstallment, DebtPayment, MonthlyBudget, Movement, MovementFilters } from '../types/finance'
import { currentMonthValue, formatDate, formatMoney, monthRange } from '../utils/format'
import { buildMonthlyClose } from '../utils/monthlyClose'
import { detectRecurringExpenses } from '../utils/recurringExpenses'

function previousMonthValue(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return format(new Date(year, monthNumber - 2, 1), 'yyyy-MM')
}

function monthLabel(month: string) {
  return format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: es })
}

function filtersForMonth(month: string): MovementFilters {
  return {
    month,
    type: 'all',
    categoryId: '',
    accountId: '',
    paymentMethod: 'all',
    from: '',
    to: '',
  }
}

export function MonthlyClosePage() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonthValue())
  const [currentMovements, setCurrentMovements] = useState<Movement[]>([])
  const [previousMovements, setPreviousMovements] = useState<Movement[]>([])
  const [allMovements, setAllMovements] = useState<Movement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([])
  const [debtInstallments, setDebtInstallments] = useState<DebtInstallment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadMonthlyClose = useCallback(() => {
    if (!user) return
    setLoading(true)
    setError('')
    const previousMonth = previousMonthValue(month)

    Promise.all([
      listMovements(user.id, filtersForMonth(month)),
      listMovements(user.id, filtersForMonth(previousMonth)),
      listAllMovements(user.id),
      listCategories(user.id).catch(() => [] as Category[]),
      listMonthlyBudgets(user.id, month).catch(() => [] as MonthlyBudget[]),
      listDebts(user.id).catch(() => [] as Debt[]),
      listDebtPayments(user.id).catch(() => [] as DebtPayment[]),
      listDebtInstallments(user.id).catch(() => [] as DebtInstallment[]),
    ])
      .then(([currentData, previousData, allData, categoryData, budgetData, debtData, paymentData, installmentData]) => {
        setCurrentMovements(currentData)
        setPreviousMovements(previousData)
        setAllMovements(allData)
        setCategories(categoryData)
        setBudgets(budgetData)
        setDebts(debtData)
        setDebtPayments(paymentData)
        setDebtInstallments(installmentData)
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el cierre mensual.')
      })
      .finally(() => setLoading(false))
  }, [month, user])

  useEffect(() => {
    loadMonthlyClose()
  }, [loadMonthlyClose])

  useEffect(() => {
    window.addEventListener(movementsChangedEvent, loadMonthlyClose)
    window.addEventListener(categoriesChangedEvent, loadMonthlyClose)
    window.addEventListener(budgetsChangedEvent, loadMonthlyClose)
    window.addEventListener(debtsChangedEvent, loadMonthlyClose)
    return () => {
      window.removeEventListener(movementsChangedEvent, loadMonthlyClose)
      window.removeEventListener(categoriesChangedEvent, loadMonthlyClose)
      window.removeEventListener(budgetsChangedEvent, loadMonthlyClose)
      window.removeEventListener(debtsChangedEvent, loadMonthlyClose)
    }
  }, [loadMonthlyClose])

  const selectedRange = useMemo(() => monthRange(month), [month])
  const recurring = useMemo(() => detectRecurringExpenses(allMovements), [allMovements])
  const monthlyClose = useMemo(
    () =>
      buildMonthlyClose({
        currentMovements,
        previousMovements,
        categories,
        budgets,
        debts,
        debtPayments,
        debtInstallments,
        recurringExpenses: recurring.items,
        recurringMonthlyEstimate: recurring.totalMonthlyEstimate,
        from: selectedRange.from,
        to: selectedRange.to,
      }),
    [
      budgets,
      categories,
      currentMovements,
      debtInstallments,
      debtPayments,
      debts,
      previousMovements,
      recurring.items,
      recurring.totalMonthlyEstimate,
      selectedRange.from,
      selectedRange.to,
    ],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100">
            Cierre mensual
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
            Revisa como cerro {monthLabel(month)}
          </h2>
        </div>
        <label className="w-full sm:w-56">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mes a revisar</span>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20"
          />
        </label>
      </div>

      {error ? <StatusMessage message={error} /> : null}

      {loading ? (
        <>
          <SkeletonStats count={4} />
          <div className="grid gap-4 xl:grid-cols-2">
            <SkeletonList rows={1} itemHeight="h-72" />
            <SkeletonList rows={1} itemHeight="h-72" />
          </div>
        </>
      ) : (
        <>
          <MonthlyCloseSummary summary={monthlyClose.summary} topCategories={monthlyClose.topCategories} />

          <section className="grid gap-4 xl:grid-cols-2">
            <BudgetCloseCard items={monthlyClose.budgetStatuses} />
            <DebtCloseCard paidDebts={monthlyClose.paidDebts} pendingPayments={monthlyClose.pendingPayments} />
          </section>

          <RecurringExpensesPanel
            items={monthlyClose.recurringExpenses}
            totalMonthlyEstimate={monthlyClose.recurringMonthlyEstimate}
            maxItems={6}
          />

          <MonthlyCloseRecommendations recommendations={monthlyClose.recommendations} />
        </>
      )}
    </div>
  )
}

function BudgetCloseCard({
  items,
}: {
  items: ReturnType<typeof buildMonthlyClose>['budgetStatuses']
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-gold-50 p-2 text-gold-700 dark:bg-gold-500/15 dark:text-gold-200">
          <PiggyBank className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-ink dark:text-white">Presupuestos a revisar</h3>
          <p className="text-sm text-muted dark:text-slate-400">Excedidos o cerca del limite.</p>
        </div>
      </div>

      {items.length ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-line p-3 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink dark:text-white">{item.name}</p>
                  <p className="text-sm text-muted dark:text-slate-400">
                    {formatMoney(item.spent)} de {formatMoney(item.budgeted)}
                  </p>
                </div>
                <span
                  className={clsx(
                    'rounded-full px-2 py-1 text-xs font-semibold',
                    item.tone === 'danger'
                      ? 'bg-coral-50 text-coral-700 dark:bg-coral-500/15 dark:text-coral-300'
                      : 'bg-gold-50 text-gold-700 dark:bg-gold-500/15 dark:text-gold-300',
                  )}
                >
                  {Math.round(item.percent)}%
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={clsx('h-2 rounded-full', item.tone === 'danger' ? 'bg-coral-500' : 'bg-gold-500')}
                  style={{ width: `${Math.min(item.percent, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted dark:text-slate-400">
          No hay presupuestos excedidos ni cerca del limite para este mes.
        </p>
      )}
    </article>
  )
}

function DebtCloseCard({
  paidDebts,
  pendingPayments,
}: {
  paidDebts: ReturnType<typeof buildMonthlyClose>['paidDebts']
  pendingPayments: ReturnType<typeof buildMonthlyClose>['pendingPayments']
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
          <CalendarCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-ink dark:text-white">Deudas y pagos pendientes</h3>
          <p className="text-sm text-muted dark:text-slate-400">Pagos logrados y compromisos importantes.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-ink dark:text-white">Deudas pagadas en el mes</p>
          {paidDebts.length ? (
            <div className="mt-2 space-y-2">
              {paidDebts.map((debt) => (
                <div key={debt.id} className="rounded-lg bg-brand-50 p-3 text-sm dark:bg-brand-500/15">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-100" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-brand-800 dark:text-brand-100">{debt.name}</p>
                      <p className="text-brand-700 dark:text-brand-100">
                        {debt.creditor} - {formatMoney(debt.amountPaid)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted dark:text-slate-400">No se detectaron deudas saldadas este mes.</p>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-ink dark:text-white">Pagos pendientes importantes</p>
          {pendingPayments.length ? (
            <div className="mt-2 space-y-2">
              {pendingPayments.slice(0, 5).map((payment) => (
                <div
                  key={payment.id}
                  className={clsx(
                    'rounded-lg p-3 text-sm',
                    payment.tone === 'danger'
                      ? 'bg-coral-50 text-coral-800 dark:bg-coral-500/15 dark:text-coral-200'
                      : 'bg-gold-50 text-gold-800 dark:bg-gold-500/15 dark:text-gold-200',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {payment.tone === 'danger' ? (
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{payment.title}</p>
                      <p>
                        {payment.detail} - {formatMoney(payment.amount)}
                        {payment.dueDate ? ` - ${formatDate(payment.dueDate)}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted dark:text-slate-400">No hay pagos urgentes detectados.</p>
          )}
        </div>
      </div>
    </article>
  )
}
