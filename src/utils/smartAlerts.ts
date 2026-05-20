import type { Category, Debt, DebtInstallment, MonthlyBudget } from '../types/finance'
import { formatDate, formatMoney } from './format'

export type SmartAlertTone = 'danger' | 'warning' | 'neutral'

export type SmartAlert = {
  id: string
  title: string
  description: string
  tone: SmartAlertTone
  priority: number
}

type CategorySpend = {
  categoryId: string
  spent: number
}

const defaultSoonDays = 7

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

function daysBetween(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`)
  const toDate = new Date(`${to}T00:00:00`)
  return Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000)
}

function isDueSoon(date: string | null, today: string, days: number) {
  if (!date || date < today) return false
  return daysBetween(today, date) <= days
}

function isInCurrentMonth(date: string | null, range = currentMonthRange()) {
  return Boolean(date && date >= range.from && date <= range.to)
}

function minimumPaymentAmount(debt: Debt) {
  return Number(debt.minimum_payment_dop ?? debt.minimum_payment ?? 0) + Number(debt.minimum_payment_usd ?? 0)
}

export function buildDebtSmartAlerts({
  debts,
  installments,
  soonDays = defaultSoonDays,
}: {
  debts: Debt[]
  installments: DebtInstallment[]
  soonDays?: number
}) {
  const today = todayValue()
  const monthRange = currentMonthRange()
  const alerts: SmartAlert[] = []
  const openDebts = debts.filter((debt) => debt.status !== 'paid')
  const openDebtIds = new Set(openDebts.map((debt) => debt.id))
  const pendingInstallments = installments.filter(
    (installment) => installment.status !== 'paid' && openDebtIds.has(installment.debt_id),
  )

  openDebts
    .filter((debt) => debt.status === 'overdue' || Boolean(debt.due_date && debt.due_date < today))
    .forEach((debt) => {
      alerts.push({
        id: `debt-overdue-${debt.id}`,
        title: 'Deuda vencida',
        description: `${debt.name} vencio${debt.due_date ? ` el ${formatDate(debt.due_date)}` : ''}. Saldo pendiente: ${formatMoney(Number(debt.outstanding_balance))}.`,
        tone: 'danger',
        priority: 100,
      })
    })

  pendingInstallments
    .filter((installment) => Boolean(installment.due_date && installment.due_date < today))
    .forEach((installment) => {
      alerts.push({
        id: `installment-overdue-${installment.id}`,
        title: 'Cuota vencida',
        description: `${installment.description} por ${formatMoney(Number(installment.amount))}${installment.due_date ? ` vencio el ${formatDate(installment.due_date)}` : ''}.`,
        tone: 'danger',
        priority: 95,
      })
    })

  openDebts
    .filter((debt) => debt.status !== 'overdue' && isDueSoon(debt.due_date, today, soonDays))
    .forEach((debt) => {
      alerts.push({
        id: `debt-due-soon-${debt.id}`,
        title: 'Deuda proxima a vencer',
        description: `${debt.name} vence el ${formatDate(String(debt.due_date))}. Saldo pendiente: ${formatMoney(Number(debt.outstanding_balance))}.`,
        tone: 'warning',
        priority: 80,
      })
    })

  pendingInstallments
    .filter((installment) => isDueSoon(installment.due_date, today, soonDays))
    .forEach((installment) => {
      alerts.push({
        id: `installment-due-soon-${installment.id}`,
        title: 'Cuota proxima a vencer',
        description: `${installment.description} vence el ${formatDate(String(installment.due_date))}. Monto: ${formatMoney(Number(installment.amount))}.`,
        tone: 'warning',
        priority: 75,
      })
    })

  openDebts
    .filter((debt) => debt.type === 'credit_card' && isDueSoon(debt.due_date, today, soonDays) && minimumPaymentAmount(debt) > 0)
    .forEach((debt) => {
      alerts.push({
        id: `card-minimum-due-${debt.id}`,
        title: 'Pago minimo de tarjeta proximo',
        description: `${debt.name} vence el ${formatDate(String(debt.due_date))}. Pago minimo estimado: ${formatMoney(minimumPaymentAmount(debt))}.`,
        tone: 'warning',
        priority: 85,
      })
    })

  const totalDebt = openDebts.reduce((total, debt) => total + Number(debt.outstanding_balance), 0)
  const pendingThisMonth = pendingInstallments
    .filter((installment) => isInCurrentMonth(installment.due_date, monthRange))
    .reduce((total, installment) => total + Number(installment.amount), 0)
  const cardMinimumsThisMonth = openDebts
    .filter((debt) => debt.type === 'credit_card' && isInCurrentMonth(debt.due_date, monthRange))
    .reduce((total, debt) => total + minimumPaymentAmount(debt), 0)

  if (openDebts.length || pendingThisMonth || cardMinimumsThisMonth) {
    alerts.push({
      id: 'debt-month-summary',
      title: 'Resumen de deuda del mes',
      description: `Deuda pendiente total: ${formatMoney(totalDebt)}. Pagos/cuotas pendientes este mes: ${formatMoney(pendingThisMonth + cardMinimumsThisMonth)}.`,
      tone: 'neutral',
      priority: 10,
    })
  }

  return alerts
}

export function buildBudgetSmartAlerts({
  budgets,
  categories,
  categorySpend,
  totalExpenses,
}: {
  budgets: MonthlyBudget[]
  categories: Category[]
  categorySpend: CategorySpend[]
  totalExpenses: number
}) {
  const spendByCategory = new Map(categorySpend.map((item) => [item.categoryId, item.spent]))
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  return budgets
    .map((budget): SmartAlert | null => {
      const budgetAmount = Number(budget.amount)
      if (budgetAmount <= 0) return null
      const spent = budget.category_id ? spendByCategory.get(budget.category_id) ?? 0 : totalExpenses
      const rawPercent = (spent / budgetAmount) * 100
      const percent = Math.round(rawPercent)
      const categoryName = budget.category_id ? categoryById.get(budget.category_id)?.name ?? 'Categoria' : 'Presupuesto general'

      if (rawPercent >= 100) {
        return {
          id: `budget-over-${budget.id}`,
          title: 'Presupuesto excedido',
          description: `${categoryName}: ${formatMoney(spent)} de ${formatMoney(budgetAmount)} (${percent}%).`,
          tone: 'danger',
          priority: 90,
        }
      }

      if (rawPercent >= 80) {
        return {
          id: `budget-warning-${budget.id}`,
          title: 'Presupuesto cerca del limite',
          description: `${categoryName}: ${formatMoney(spent)} de ${formatMoney(budgetAmount)} (${percent}%).`,
          tone: 'warning',
          priority: 70,
        }
      }

      return null
    })
    .filter((alert): alert is SmartAlert => Boolean(alert))
}

export function sortSmartAlerts(alerts: SmartAlert[]) {
  return alerts.toSorted((first, second) => second.priority - first.priority)
}
