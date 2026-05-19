import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Movement, PaymentMethod } from '../types/finance'
import { paymentMethodLabel } from './format'

export type ReportSummary = {
  income: number
  expenses: number
  balance: number
  movementCount: number
}

export type CategoryReportRow = {
  id: string
  name: string
  color: string
  income: number
  expenses: number
  balance: number
  count: number
}

export type PaymentMethodReportRow = {
  method: PaymentMethod
  name: string
  income: number
  expenses: number
  balance: number
  count: number
}

export type MonthlyReportRow = {
  month: string
  name: string
  income: number
  expenses: number
  balance: number
  count: number
}

function addMovementTotals<T extends { income: number; expenses: number; balance: number; count: number }>(
  row: T,
  movement: Movement,
) {
  const amount = Number(movement.amount)
  if (movement.type === 'income') row.income += amount
  if (movement.type === 'expense') row.expenses += amount
  row.balance = row.income - row.expenses
  row.count += 1
}

export function buildReportSummary(movements: Movement[]): ReportSummary {
  const summary = movements.reduce(
    (total, movement) => {
      const amount = Number(movement.amount)
      if (movement.type === 'income') total.income += amount
      if (movement.type === 'expense') total.expenses += amount
      total.movementCount += 1
      return total
    },
    { income: 0, expenses: 0, movementCount: 0 },
  )

  return {
    ...summary,
    balance: summary.income - summary.expenses,
  }
}

export function groupByCategory(movements: Movement[]): CategoryReportRow[] {
  const rows = new Map<string, CategoryReportRow>()

  movements.forEach((movement) => {
    const id = movement.category?.id ?? 'uncategorized'
    const row = rows.get(id) ?? {
      id,
      name: movement.category?.name ?? 'Sin categoria',
      color: movement.category?.color ?? '#64748b',
      income: 0,
      expenses: 0,
      balance: 0,
      count: 0,
    }
    addMovementTotals(row, movement)
    rows.set(id, row)
  })

  return Array.from(rows.values()).sort((a, b) => b.expenses - a.expenses || b.income - a.income)
}

export function groupByPaymentMethod(movements: Movement[]): PaymentMethodReportRow[] {
  const rows = new Map<PaymentMethod, PaymentMethodReportRow>()

  movements.forEach((movement) => {
    const row = rows.get(movement.payment_method) ?? {
      method: movement.payment_method,
      name: paymentMethodLabel(movement.payment_method),
      income: 0,
      expenses: 0,
      balance: 0,
      count: 0,
    }
    addMovementTotals(row, movement)
    rows.set(movement.payment_method, row)
  })

  return Array.from(rows.values()).sort((a, b) => b.count - a.count || b.expenses - a.expenses)
}

export function groupByMonth(movements: Movement[]): MonthlyReportRow[] {
  const rows = new Map<string, MonthlyReportRow>()

  movements.forEach((movement) => {
    const month = movement.date.slice(0, 7)
    const row = rows.get(month) ?? {
      month,
      name: format(parseISO(`${month}-01`), 'MMM yy', { locale: es }),
      income: 0,
      expenses: 0,
      balance: 0,
      count: 0,
    }
    addMovementTotals(row, movement)
    rows.set(month, row)
  })

  return Array.from(rows.values()).sort((a, b) => a.month.localeCompare(b.month))
}
