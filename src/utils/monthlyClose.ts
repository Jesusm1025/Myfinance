import type { Category, Debt, DebtInstallment, DebtPayment, MonthlyBudget, Movement } from '../types/finance'
import type { RecurringExpense } from './recurringExpenses'

export type MonthlyCloseTone = 'positive' | 'warning' | 'danger' | 'neutral'

export type MonthlyCloseSummary = {
  income: number
  expenses: number
  balance: number
  previousIncome: number
  previousExpenses: number
  previousBalance: number
  incomeChangePercent: number | null
  expensesChangePercent: number | null
  balanceChange: number
}

export type MonthlyCloseCategory = {
  id: string
  name: string
  color: string
  amount: number
  percentOfExpenses: number
}

export type MonthlyCloseBudgetStatus = {
  id: string
  name: string
  budgeted: number
  spent: number
  percent: number
  tone: 'warning' | 'danger'
}

export type MonthlyClosePaidDebt = {
  id: string
  name: string
  creditor: string
  amountPaid: number
}

export type MonthlyClosePendingPayment = {
  id: string
  title: string
  detail: string
  amount: number
  dueDate: string | null
  tone: 'warning' | 'danger'
}

export type MonthlyCloseRecommendation = {
  id: string
  title: string
  description: string
  tone: MonthlyCloseTone
}

export type MonthlyCloseResult = {
  summary: MonthlyCloseSummary
  topCategories: MonthlyCloseCategory[]
  budgetStatuses: MonthlyCloseBudgetStatus[]
  paidDebts: MonthlyClosePaidDebt[]
  pendingPayments: MonthlyClosePendingPayment[]
  recurringExpenses: RecurringExpense[]
  recurringMonthlyEstimate: number
  recommendations: MonthlyCloseRecommendation[]
}

function sumByType(movements: Movement[], type: 'income' | 'expense') {
  return movements
    .filter((movement) => movement.type === type)
    .reduce((total, movement) => total + Number(movement.amount), 0)
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

function inRange(date: string | null | undefined, from: string, to: string) {
  return Boolean(date && date >= from && date <= to)
}

function daysUntil(value: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [year, month, day] = value.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function categoryName(categoryId: string | null, categories: Category[]) {
  if (!categoryId) return 'Presupuesto general'
  return categories.find((category) => category.id === categoryId)?.name ?? 'Categoria'
}

function buildSummary(currentMovements: Movement[], previousMovements: Movement[]): MonthlyCloseSummary {
  const income = sumByType(currentMovements, 'income')
  const expenses = sumByType(currentMovements, 'expense')
  const previousIncome = sumByType(previousMovements, 'income')
  const previousExpenses = sumByType(previousMovements, 'expense')
  const previousBalance = previousIncome - previousExpenses
  const balance = income - expenses

  return {
    income,
    expenses,
    balance,
    previousIncome,
    previousExpenses,
    previousBalance,
    incomeChangePercent: percentChange(income, previousIncome),
    expensesChangePercent: percentChange(expenses, previousExpenses),
    balanceChange: balance - previousBalance,
  }
}

function buildTopCategories(movements: Movement[], limit = 5): MonthlyCloseCategory[] {
  const expenses = sumByType(movements, 'expense')
  const rows = new Map<string, MonthlyCloseCategory>()

  movements
    .filter((movement) => movement.type === 'expense')
    .forEach((movement) => {
      const key = movement.category_id ?? 'uncategorized'
      const current = rows.get(key) ?? {
        id: key,
        name: movement.category?.name ?? 'Sin categoria',
        color: movement.category?.color ?? '#64748b',
        amount: 0,
        percentOfExpenses: 0,
      }
      current.amount += Number(movement.amount)
      current.percentOfExpenses = expenses > 0 ? (current.amount / expenses) * 100 : 0
      rows.set(key, current)
    })

  return Array.from(rows.values()).sort((a, b) => b.amount - a.amount).slice(0, limit)
}

function buildBudgetStatuses(
  budgets: MonthlyBudget[],
  currentMovements: Movement[],
  categories: Category[],
): MonthlyCloseBudgetStatus[] {
  const totalExpenses = sumByType(currentMovements, 'expense')
  const spendByCategory = new Map<string, number>()

  currentMovements
    .filter((movement) => movement.type === 'expense' && movement.category_id)
    .forEach((movement) => {
      const categoryId = String(movement.category_id)
      spendByCategory.set(categoryId, (spendByCategory.get(categoryId) ?? 0) + Number(movement.amount))
    })

  return budgets
    .map((budget): MonthlyCloseBudgetStatus | null => {
      const budgeted = Number(budget.amount)
      if (budgeted <= 0) return null
      const spent = budget.category_id ? spendByCategory.get(budget.category_id) ?? 0 : totalExpenses
      const percent = (spent / budgeted) * 100
      if (percent < 80) return null

      return {
        id: budget.id,
        name: categoryName(budget.category_id, categories),
        budgeted,
        spent,
        percent,
        tone: percent >= 100 ? 'danger' : 'warning',
      }
    })
    .filter((item): item is MonthlyCloseBudgetStatus => Boolean(item))
    .sort((a, b) => b.percent - a.percent)
}

function buildPaidDebts(debts: Debt[], payments: DebtPayment[], from: string, to: string): MonthlyClosePaidDebt[] {
  const paidDebts = debts.filter((debt) => debt.status === 'paid')
  return paidDebts
    .map((debt): MonthlyClosePaidDebt | null => {
      const paymentsInMonth = payments.filter((payment) => payment.debt_id === debt.id && inRange(payment.payment_date, from, to))
      const amountPaid = paymentsInMonth.reduce((total, payment) => total + Number(payment.amount), 0)
      if (amountPaid <= 0) return null

      return {
        id: debt.id,
        name: debt.name,
        creditor: debt.creditor,
        amountPaid,
      }
    })
    .filter((item): item is MonthlyClosePaidDebt => Boolean(item))
    .sort((a, b) => b.amountPaid - a.amountPaid)
}

function buildPendingPayments(debts: Debt[], installments: DebtInstallment[]): MonthlyClosePendingPayment[] {
  const openDebtIds = new Set(debts.filter((debt) => debt.status !== 'paid').map((debt) => debt.id))
  const debtRows = debts
    .filter((debt) => debt.status !== 'paid' && debt.due_date)
    .filter((debt) => {
      const days = daysUntil(String(debt.due_date))
      return days <= 10
    })
    .map((debt): MonthlyClosePendingPayment => {
      const days = daysUntil(String(debt.due_date))
      return {
        id: `debt-${debt.id}`,
        title: debt.name,
        detail: days < 0 ? 'Deuda vencida' : `Vence en ${days} dia${days === 1 ? '' : 's'}`,
        amount: Number(debt.outstanding_balance),
        dueDate: debt.due_date,
        tone: days < 0 ? 'danger' : 'warning',
      }
    })

  const installmentRows = installments
    .filter((installment) => installment.status !== 'paid' && openDebtIds.has(installment.debt_id) && installment.due_date)
    .filter((installment) => {
      const days = daysUntil(String(installment.due_date))
      return days <= 10
    })
    .map((installment): MonthlyClosePendingPayment => {
      const days = daysUntil(String(installment.due_date))
      return {
        id: `installment-${installment.id}`,
        title: installment.description,
        detail: days < 0 ? 'Cuota vencida' : `Cuota vence en ${days} dia${days === 1 ? '' : 's'}`,
        amount: Number(installment.amount),
        dueDate: installment.due_date,
        tone: days < 0 ? 'danger' : 'warning',
      }
    })

  return [...debtRows, ...installmentRows].sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === 'danger' ? -1 : 1
    return (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
  })
}

function buildRecommendations({
  summary,
  topCategories,
  budgetStatuses,
  paidDebts,
  pendingPayments,
  recurringMonthlyEstimate,
}: {
  summary: MonthlyCloseSummary
  topCategories: MonthlyCloseCategory[]
  budgetStatuses: MonthlyCloseBudgetStatus[]
  paidDebts: MonthlyClosePaidDebt[]
  pendingPayments: MonthlyClosePendingPayment[]
  recurringMonthlyEstimate: number
}): MonthlyCloseRecommendation[] {
  const recommendations: MonthlyCloseRecommendation[] = []

  if (summary.balance < 0) {
    recommendations.push({
      id: 'negative-balance',
      title: 'Ajusta el gasto del proximo mes',
      description: 'Cerraste el mes con balance negativo. Revisa las categorias mas altas antes de registrar nuevos compromisos.',
      tone: 'danger',
    })
  } else if (summary.balance > 0) {
    recommendations.push({
      id: 'positive-balance',
      title: 'Aprovecha el balance positivo',
      description: 'Puedes separar una parte para ahorro, fondo de emergencia o pago anticipado de deuda.',
      tone: 'positive',
    })
  }

  const overBudget = budgetStatuses.find((budget) => budget.tone === 'danger')
  if (overBudget) {
    recommendations.push({
      id: 'over-budget',
      title: `Controla ${overBudget.name}`,
      description: 'Esta categoria supero el presupuesto. Considera subir el presupuesto realista o reducir compras relacionadas.',
      tone: 'danger',
    })
  }

  const topCategory = topCategories[0]
  if (topCategory && topCategory.percentOfExpenses >= 35) {
    recommendations.push({
      id: 'top-category',
      title: `Revisa ${topCategory.name}`,
      description: 'Esta categoria concentra una parte importante de tus gastos del mes.',
      tone: 'warning',
    })
  }

  if (pendingPayments.some((payment) => payment.tone === 'danger')) {
    recommendations.push({
      id: 'overdue-payments',
      title: 'Prioriza pagos vencidos',
      description: 'Tienes pagos o cuotas vencidas. Resolverlos primero puede evitar recargos e intereses.',
      tone: 'danger',
    })
  }

  if (recurringMonthlyEstimate > 0 && summary.income > 0 && recurringMonthlyEstimate / summary.income >= 0.2) {
    recommendations.push({
      id: 'recurring-review',
      title: 'Audita tus gastos recurrentes',
      description: 'Los cargos recurrentes tienen un peso relevante frente a tus ingresos. Revisa suscripciones que ya no uses.',
      tone: 'warning',
    })
  }

  if (paidDebts.length) {
    recommendations.push({
      id: 'paid-debts',
      title: 'Mantén el impulso de pago',
      description: 'Registraste deudas pagadas este mes. Puedes redirigir ese monto a ahorro o a la siguiente deuda prioritaria.',
      tone: 'positive',
    })
  }

  if (!recommendations.length) {
    recommendations.push({
      id: 'stable-month',
      title: 'Mes estable',
      description: 'No se detectaron alertas fuertes. Mantener registros frecuentes ayudara a mejorar las recomendaciones.',
      tone: 'neutral',
    })
  }

  return recommendations.slice(0, 6)
}

export function buildMonthlyClose({
  currentMovements,
  previousMovements,
  categories,
  budgets,
  debts,
  debtPayments,
  debtInstallments,
  recurringExpenses,
  recurringMonthlyEstimate,
  from,
  to,
}: {
  currentMovements: Movement[]
  previousMovements: Movement[]
  categories: Category[]
  budgets: MonthlyBudget[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  debtInstallments: DebtInstallment[]
  recurringExpenses: RecurringExpense[]
  recurringMonthlyEstimate: number
  from: string
  to: string
}): MonthlyCloseResult {
  const summary = buildSummary(currentMovements, previousMovements)
  const topCategories = buildTopCategories(currentMovements)
  const budgetStatuses = buildBudgetStatuses(budgets, currentMovements, categories)
  const paidDebts = buildPaidDebts(debts, debtPayments, from, to)
  const pendingPayments = buildPendingPayments(debts, debtInstallments)
  const recommendations = buildRecommendations({
    summary,
    topCategories,
    budgetStatuses,
    paidDebts,
    pendingPayments,
    recurringMonthlyEstimate,
  })

  return {
    summary,
    topCategories,
    budgetStatuses,
    paidDebts,
    pendingPayments,
    recurringExpenses,
    recurringMonthlyEstimate,
    recommendations,
  }
}
