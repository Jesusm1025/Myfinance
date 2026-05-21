import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeDollarSign,
  CalendarClock,
  Gauge,
  PiggyBank,
  ShieldAlert,
  Tags,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState } from '../components/EmptyState'
import { QuickWidgets, type QuickWidget } from '../components/QuickWidgets'
import { RecurringExpensesPanel } from '../components/RecurringExpensesPanel'
import { SkeletonList, SkeletonStats } from '../components/Skeleton'
import { SmartAlertsPanel } from '../components/SmartAlertsPanel'
import { StatCard } from '../components/StatCard'
import { StatusMessage } from '../components/StatusMessage'
import { accountsChangedEvent, budgetsChangedEvent, categoriesChangedEvent, debtsChangedEvent, movementsChangedEvent, savingsGoalsChangedEvent } from '../events/financeEvents'
import { listAccountTransfers, listAccounts, listAllMovements, listCategories, listDebtInstallments, listDebts, listMonthlyBudgets, listMovements, listSavingsGoals } from '../services/accounting'
import type { Account, AccountTransfer, Category, Debt, DebtInstallment, MonthlyBudget, Movement, MovementFilters, SavingsGoal } from '../types/finance'
import { buildAccountBalances, totalAccountBalance } from '../utils/accounts'
import { currentMonthValue, formatDate, formatMoney, monthRange, paymentMethodLabel } from '../utils/format'
import { detectRecurringExpenses } from '../utils/recurringExpenses'
import { buildBudgetSmartAlerts, buildDebtSmartAlerts, sortSmartAlerts } from '../utils/smartAlerts'
import { formatCurrencyAmount, getActiveCurrency } from '../utils/currency'
import { savingsGoalProgress } from '../components/SavingsGoalCard'

const emptyFilters: MovementFilters = {
  month: currentMonthValue(),
  type: 'all',
  categoryId: '',
  accountId: '',
  paymentMethod: 'all',
  from: '',
  to: '',
}

function sumByType(movements: Movement[], type: 'income' | 'expense') {
  return movements
    .filter((movement) => movement.type === type)
    .reduce((total, movement) => total + Number(movement.amount), 0)
}

function chartMonthLabel(month: string) {
  return format(parseISO(`${month}-01`), 'MMM yy', { locale: es })
}

function daysUntil(date: string | null | undefined) {
  if (!date) return Number.POSITIVE_INFINITY
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [year, monthNumber, day] = date.split('-').map(Number)
  const target = new Date(year, monthNumber - 1, day)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

export function DashboardPage() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonthValue())
  const [monthlyMovements, setMonthlyMovements] = useState<Movement[]>([])
  const [allMovements, setAllMovements] = useState<Movement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [installments, setInstallments] = useState<DebtInstallment[]>([])
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountTransfers, setAccountTransfers] = useState<AccountTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(() => {
    if (!user) return
    setLoading(true)
    setError('')

    Promise.all([
      listMovements(user.id, { ...emptyFilters, month }),
      listAllMovements(user.id),
      listCategories(user.id).catch(() => [] as Category[]),
      listMonthlyBudgets(user.id, month).catch(() => [] as MonthlyBudget[]),
      listDebts(user.id).catch(() => [] as Debt[]),
      listDebtInstallments(user.id).catch(() => [] as DebtInstallment[]),
      listSavingsGoals(user.id).catch(() => [] as SavingsGoal[]),
      listAccounts(user.id).catch(() => [] as Account[]),
      listAccountTransfers(user.id).catch(() => [] as AccountTransfer[]),
    ])
      .then(([monthData, allData, categoryData, budgetData, debtData, installmentData, savingsGoalData, accountData, transferData]) => {
        setMonthlyMovements(monthData)
        setAllMovements(allData)
        setCategories(categoryData)
        setBudgets(budgetData)
        setDebts(debtData)
        setInstallments(installmentData)
        setSavingsGoals(savingsGoalData)
        setAccounts(accountData)
        setAccountTransfers(transferData)
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el dashboard.')
      })
      .finally(() => setLoading(false))
  }, [month, user])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    window.addEventListener(movementsChangedEvent, loadDashboard)
    window.addEventListener(categoriesChangedEvent, loadDashboard)
    window.addEventListener(budgetsChangedEvent, loadDashboard)
    window.addEventListener(debtsChangedEvent, loadDashboard)
    window.addEventListener(savingsGoalsChangedEvent, loadDashboard)
    window.addEventListener(accountsChangedEvent, loadDashboard)
    return () => {
      window.removeEventListener(movementsChangedEvent, loadDashboard)
      window.removeEventListener(categoriesChangedEvent, loadDashboard)
      window.removeEventListener(budgetsChangedEvent, loadDashboard)
      window.removeEventListener(debtsChangedEvent, loadDashboard)
      window.removeEventListener(savingsGoalsChangedEvent, loadDashboard)
      window.removeEventListener(accountsChangedEvent, loadDashboard)
    }
  }, [loadDashboard])

  const monthlySummary = useMemo(() => {
    const income = sumByType(monthlyMovements, 'income')
    const expenses = sumByType(monthlyMovements, 'expense')
    return { income, expenses, balance: income - expenses }
  }, [monthlyMovements])

  const accountBalances = useMemo(
    () => buildAccountBalances(accounts, allMovements, accountTransfers),
    [accounts, accountTransfers, allMovements],
  )
  const generalBalance = useMemo(() => {
    if (accountBalances.length) return totalAccountBalance(accountBalances)
    return sumByType(allMovements, 'income') - sumByType(allMovements, 'expense')
  }, [accountBalances, allMovements])

  const expensesByCategory = useMemo(() => {
    const totals = new Map<string, { id: string; name: string; value: number; color: string }>()
    monthlyMovements
      .filter((movement) => movement.type === 'expense')
      .forEach((movement) => {
        const key = movement.category?.id ?? 'uncategorized'
        const previous = totals.get(key)
        totals.set(key, {
          id: key,
          name: movement.category?.name ?? 'Sin categoria',
          color: movement.category?.color ?? '#64748b',
          value: (previous?.value ?? 0) + Number(movement.amount),
        })
      })
    return Array.from(totals.values()).sort((a, b) => b.value - a.value)
  }, [monthlyMovements])

  const topExpenseCategory = expensesByCategory[0]

  const latestMovements = useMemo(() => allMovements.slice(0, 5), [allMovements])

  const incomeVsExpensesByMonth = useMemo(() => {
    const selectedRange = monthRange(month)
    const selectedMonth = month
    const totals = new Map<string, { month: string; ingresos: number; gastos: number }>()

    allMovements.forEach((movement) => {
      const movementMonth = movement.date.slice(0, 7)
      const current = totals.get(movementMonth) ?? {
        month: movementMonth,
        ingresos: 0,
        gastos: 0,
      }

      if (movement.type === 'income') current.ingresos += Number(movement.amount)
      if (movement.type === 'expense') current.gastos += Number(movement.amount)
      totals.set(movementMonth, current)
    })

    if (!totals.has(selectedMonth)) {
      totals.set(selectedMonth, {
        month: selectedMonth,
        ingresos: monthlySummary.income,
        gastos: monthlySummary.expenses,
      })
    }

    return Array.from(totals.values())
      .filter((item) => item.month <= selectedMonth || item.month >= selectedRange.from.slice(0, 7))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map((item) => ({ ...item, name: chartMonthLabel(item.month) }))
  }, [allMovements, month, monthlySummary.expenses, monthlySummary.income])

  const expensesBeatIncome = monthlySummary.expenses > monthlySummary.income
  const categorySpend = useMemo(() => {
    const totals = new Map<string, number>()
    monthlyMovements
      .filter((movement) => movement.type === 'expense' && movement.category_id)
      .forEach((movement) => {
        totals.set(String(movement.category_id), (totals.get(String(movement.category_id)) ?? 0) + Number(movement.amount))
      })
    return Array.from(totals.entries()).map(([categoryId, spent]) => ({ categoryId, spent }))
  }, [monthlyMovements])
  const smartAlerts = useMemo(() => {
    const budgetAlerts = buildBudgetSmartAlerts({
      budgets,
      categories,
      categorySpend,
      totalExpenses: monthlySummary.expenses,
    })
    const debtAlerts = buildDebtSmartAlerts({ debts, installments })
    return sortSmartAlerts([...budgetAlerts, ...debtAlerts]).slice(0, 5)
  }, [budgets, categories, categorySpend, debts, installments, monthlySummary.expenses])
  const recurringExpenses = useMemo(() => detectRecurringExpenses(allMovements), [allMovements])
  const savingsGoalsSummary = useMemo(() => {
    const activeGoals = savingsGoals.filter((goal) => goal.status !== 'cancelled')
    const currency = getActiveCurrency()
    const goalsInCurrency = activeGoals.filter((goal) => goal.currency === currency)
    const totalSaved = goalsInCurrency.reduce((total, goal) => total + Number(goal.current_amount), 0)
    const averageProgress = activeGoals.length
      ? activeGoals.reduce((total, goal) => total + savingsGoalProgress(goal), 0) / activeGoals.length
      : 0
    const mainGoal = activeGoals
      .filter((goal) => goal.status !== 'completed')
      .sort((a, b) => savingsGoalProgress(b) - savingsGoalProgress(a))[0]
    const closestGoal = activeGoals
      .filter((goal) => goal.status !== 'completed' && goal.target_date)
      .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)))[0]

    return { totalSaved, averageProgress, mainGoal, closestGoal }
  }, [savingsGoals])

  const topExpenseMovement = useMemo(() => {
    return monthlyMovements
      .filter((movement) => movement.type === 'expense')
      .sort((a, b) => Number(b.amount) - Number(a.amount))[0]
  }, [monthlyMovements])

  const priorityDebt = useMemo(() => {
    return debts
      .filter((debt) => debt.status !== 'paid' && Number(debt.outstanding_balance) > 0)
      .sort((a, b) => {
        const aDue = daysUntil(a.due_date)
        const bDue = daysUntil(b.due_date)
        const aUrgency = a.status === 'overdue' || aDue < 0 ? -10_000 : aDue
        const bUrgency = b.status === 'overdue' || bDue < 0 ? -10_000 : bDue
        if (aUrgency !== bUrgency) return aUrgency - bUrgency
        return Number(b.outstanding_balance) - Number(a.outstanding_balance)
      })[0]
  }, [debts])

  const budgetRisk = useMemo(() => {
    const categoryById = new Map(categories.map((category) => [category.id, category]))
    const spentByCategory = new Map(categorySpend.map((item) => [item.categoryId, item.spent]))

    return budgets
      .filter((budget) => budget.category_id && Number(budget.amount) > 0)
      .map((budget) => {
        const spent = spentByCategory.get(String(budget.category_id)) ?? 0
        const percent = (spent / Number(budget.amount)) * 100
        const category = categoryById.get(String(budget.category_id))
        return { budget, spent, percent, categoryName: category?.name ?? 'Categoria' }
      })
      .sort((a, b) => b.percent - a.percent)[0]
  }, [budgets, categories, categorySpend])

  const recommendedSavings = useMemo(() => {
    if (monthlySummary.balance <= 0 || generalBalance <= 0) return 0
    return Math.max(0, Math.min(monthlySummary.balance * 0.3, generalBalance * 0.25))
  }, [generalBalance, monthlySummary.balance])

  const quickWidgets = useMemo<QuickWidget[]>(() => [
    {
      id: 'highest-expense',
      label: 'Gasto mas alto',
      value: topExpenseMovement ? formatMoney(Number(topExpenseMovement.amount)) : 'Sin gastos',
      detail: topExpenseMovement
        ? topExpenseMovement.description || topExpenseMovement.category?.name || 'Movimiento del mes'
        : 'No hay gastos en el mes seleccionado.',
      icon: BadgeDollarSign,
      tone: topExpenseMovement ? 'coral' : 'slate',
    },
    {
      id: 'priority-debt',
      label: 'Deuda prioritaria',
      value: priorityDebt?.name ?? 'Sin deuda abierta',
      detail: priorityDebt
        ? `${formatMoney(Number(priorityDebt.outstanding_balance))} pendiente${priorityDebt.due_date ? ` - vence ${formatDate(priorityDebt.due_date)}` : ''}`
        : 'No hay saldos pendientes registrados.',
      icon: ShieldAlert,
      tone: priorityDebt ? 'gold' : 'brand',
    },
    {
      id: 'closest-goal',
      label: 'Meta cercana',
      value: savingsGoalsSummary.closestGoal?.name ?? savingsGoalsSummary.mainGoal?.name ?? 'Sin meta activa',
      detail: savingsGoalsSummary.closestGoal?.target_date
        ? `Objetivo: ${formatDate(savingsGoalsSummary.closestGoal.target_date)}`
        : `${Math.round(savingsGoalsSummary.averageProgress)}% de progreso promedio.`,
      icon: Target,
      tone: savingsGoalsSummary.closestGoal ? 'brand' : 'slate',
    },
    {
      id: 'budget-risk',
      label: 'Presupuesto comprometido',
      value: budgetRisk ? budgetRisk.categoryName : 'Sin alertas',
      detail: budgetRisk
        ? `${Math.round(budgetRisk.percent)}% usado: ${formatMoney(budgetRisk.spent)} de ${formatMoney(Number(budgetRisk.budget.amount))}`
        : 'Los presupuestos del mes se mantienen tranquilos.',
      icon: Gauge,
      tone: budgetRisk && budgetRisk.percent >= 100 ? 'coral' : budgetRisk && budgetRisk.percent >= 80 ? 'gold' : 'brand',
    },
    {
      id: 'available-balance',
      label: 'Balance disponible',
      value: formatMoney(generalBalance),
      detail: 'Calculado desde Cuentas, movimientos y transferencias.',
      icon: Wallet,
      tone: generalBalance >= 0 ? 'brand' : 'coral',
    },
    {
      id: 'recommended-savings',
      label: 'Ahorro recomendado',
      value: formatMoney(recommendedSavings),
      detail: recommendedSavings > 0
        ? 'Monto conservador sugerido desde el balance positivo.'
        : 'Primero estabiliza gastos o deuda antes de separar ahorro.',
      icon: PiggyBank,
      tone: recommendedSavings > 0 ? 'brand' : 'slate',
    },
  ], [
    budgetRisk,
    generalBalance,
    priorityDebt,
    recommendedSavings,
    savingsGoalsSummary.averageProgress,
    savingsGoalsSummary.closestGoal,
    savingsGoalsSummary.mainGoal,
    topExpenseMovement,
  ])

  return (
    <div className="space-y-6">
      <div className="premium-card overflow-hidden rounded-lg border border-line bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="border-b border-line bg-gradient-to-br from-brand-50 via-white to-slate-50 px-4 py-5 dark:border-slate-800 dark:from-brand-500/10 dark:via-slate-900 dark:to-slate-900 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100">
                Dashboard financiero
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
                Resumen de tus finanzas
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Lectura rapida del mes, alertas y prioridades para tomar decisiones sin entrar a cada modulo.
              </p>
            </div>
            <label className="w-full sm:w-56">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <CalendarClock className="h-4 w-4" />
                Mes visible
              </span>
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:focus:ring-brand-500/20"
              />
            </label>
          </div>
        </div>
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6">
          <SmallMetric label="Balance mensual" value={formatMoney(monthlySummary.balance)} tone={monthlySummary.balance >= 0 ? 'income' : 'expense'} />
          <SmallMetric label="Movimientos del mes" value={String(monthlyMovements.length)} />
          <SmallMetric label="Alertas activas" value={loading ? '...' : String(smartAlerts.length)} tone={smartAlerts.length ? 'warning' : 'income'} />
        </div>
      </div>

      {error ? <StatusMessage message={error} /> : null}
      {expensesBeatIncome ? (
        <div className="premium-card flex items-start gap-3 rounded-lg border border-coral-500/30 bg-coral-50 px-4 py-3 text-sm text-coral-600 dark:border-coral-500/30 dark:bg-coral-500/10 dark:text-coral-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Alerta: tus gastos del mes superan tus ingresos por {formatMoney(monthlySummary.expenses - monthlySummary.income)}.</span>
        </div>
      ) : null}
      {!loading ? <SmartAlertsPanel alerts={smartAlerts} compact /> : null}
      {!loading ? (
        <RecurringExpensesPanel
          items={recurringExpenses.items}
          totalMonthlyEstimate={recurringExpenses.totalMonthlyEstimate}
          compact
          maxItems={5}
        />
      ) : null}

      {!loading ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-ink dark:text-white">Widgets rapidos</h3>
            <p className="text-sm text-muted dark:text-slate-400">
              Prioridades compactas para revisar en segundos.
            </p>
          </div>
          <QuickWidgets widgets={quickWidgets} />
        </section>
      ) : null}

      {loading ? (
        <SkeletonStats count={5} />
      ) : (
        <div className="space-y-2">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Ingresos del mes" value={formatMoney(monthlySummary.income)} icon={ArrowUpCircle} />
            <StatCard title="Gastos del mes" value={formatMoney(monthlySummary.expenses)} icon={ArrowDownCircle} tone="coral" />
            <StatCard title="Balance mensual" value={formatMoney(monthlySummary.balance)} icon={Wallet} tone="gold" />
            <StatCard title="Balance general" value={formatMoney(generalBalance)} icon={TrendingUp} />
            <StatCard
              title="Mayor gasto"
              value={topExpenseCategory ? topExpenseCategory.name : 'Sin gastos'}
              icon={Tags}
              tone="coral"
            />
          </section>
          <p className="text-xs text-muted dark:text-slate-400">
            El balance general usa los saldos de Cuentas: balance inicial, movimientos y transferencias.
          </p>
        </div>
      )}

      {!loading && savingsGoals.length ? (
        <section className="premium-card rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-ink dark:text-white">Resumen de metas de ahorro</h3>
              <p className="text-sm text-muted dark:text-slate-400">Avance general de tus objetivos activos.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SmallMetric label="Meta principal" value={savingsGoalsSummary.mainGoal?.name ?? 'Sin meta activa'} />
            <SmallMetric label="Total ahorrado" value={formatCurrencyAmount(savingsGoalsSummary.totalSaved)} />
            <SmallMetric label="Meta mas cercana" value={savingsGoalsSummary.closestGoal?.name ?? 'Sin fecha'} />
            <SmallMetric label="Progreso promedio" value={`${Math.round(savingsGoalsSummary.averageProgress)}%`} />
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <article className="premium-card rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90 sm:p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Gastos por categoria</h3>
            <p className="text-sm text-muted dark:text-slate-400">
              Distribucion del mes seleccionado
            </p>
          </div>
          {loading ? (
            <SkeletonList rows={1} itemHeight="h-72" />
          ) : expensesByCategory.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expensesByCategory} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92}>
                    {expensesByCategory.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Sin gastos registrados" detail="Cuando registres gastos del mes, apareceran agrupados aqui." />
          )}
        </article>

        <article className="premium-card rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90 sm:p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Ingresos vs gastos por mes</h3>
            <p className="text-sm text-muted dark:text-slate-400">Hasta los ultimos 12 meses con movimientos</p>
          </div>
          {loading ? (
            <SkeletonList rows={1} itemHeight="h-72" />
          ) : incomeVsExpensesByMonth.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeVsExpensesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Legend />
                  <Bar dataKey="ingresos" fill="#198c7c" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="gastos" fill="#ee6c4d" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Sin datos para graficar" detail="Agrega ingresos o gastos para comparar tus meses." />
          )}
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="premium-card rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90 sm:p-5">
          <h3 className="text-lg font-semibold">Categoria donde mas gastaste</h3>
          {topExpenseCategory ? (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-line p-4 dark:border-slate-800">
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-11 w-11 rounded-lg" style={{ backgroundColor: topExpenseCategory.color }} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{topExpenseCategory.name}</p>
                  <p className="text-sm text-muted dark:text-slate-400">Total gastado en el mes</p>
                </div>
              </div>
              <p className="shrink-0 text-lg font-semibold text-coral-600 dark:text-coral-400">
                {formatMoney(topExpenseCategory.value)}
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="Sin categoria destacada" detail="No hay gastos en el mes seleccionado." />
            </div>
          )}
        </article>

        <article className="premium-card rounded-lg border border-line bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90">
          <div className="border-b border-line p-4 dark:border-slate-800 sm:p-5">
            <h3 className="text-lg font-semibold">Ultimos 5 movimientos</h3>
            <p className="text-sm text-muted dark:text-slate-400">Ordenados del mas reciente al mas antiguo</p>
          </div>
          {loading ? (
            <div className="p-4 sm:p-5">
              <SkeletonList rows={3} itemHeight="h-16" />
            </div>
          ) : latestMovements.length ? (
            <div className="divide-y divide-line dark:divide-slate-800">
              {latestMovements.map((movement) => (
                <div key={movement.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-1 h-10 w-10 rounded-lg"
                      style={{ backgroundColor: movement.category?.color ?? '#64748b' }}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {movement.description || movement.category?.name || 'Movimiento'}
                      </p>
                      <p className="text-sm text-muted dark:text-slate-400">
                        {movement.category?.name ?? 'Sin categoria'} - {formatDate(movement.date)} -{' '}
                        {paymentMethodLabel(movement.payment_method)}
                      </p>
                    </div>
                  </div>
                  <p
                    className={clsx(
                      'text-lg font-semibold sm:text-right',
                      movement.type === 'income'
                        ? 'text-brand-700 dark:text-brand-100'
                        : 'text-coral-600 dark:text-coral-400',
                    )}
                  >
                    {movement.type === 'income' ? '+' : '-'}
                    {formatMoney(Number(movement.amount))}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <EmptyState title="Sin movimientos" detail="Tus ultimos movimientos apareceran aqui." />
            </div>
          )}
        </article>
      </section>
    </div>
  )
}

function SmallMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'income' | 'expense' | 'warning'
}) {
  return (
    <div className="rounded-lg bg-slate-50/80 p-3 ring-1 ring-slate-900/5 dark:bg-slate-950/70 dark:ring-white/5">
      <p className="text-xs text-muted dark:text-slate-400">{label}</p>
      <p
        className={clsx(
          'mt-1 truncate font-semibold',
          tone === 'income' && 'text-brand-700 dark:text-brand-100',
          tone === 'expense' && 'text-coral-600 dark:text-coral-300',
          tone === 'warning' && 'text-gold-600 dark:text-gold-300',
          !tone && 'text-ink dark:text-white',
        )}
      >
        {value}
      </p>
    </div>
  )
}
