import type { Category, MonthlyBudget, Movement } from '../types/finance'
import type { RecurringExpense } from './recurringExpenses'

export type AutoBudgetConfidence = 'very_low' | 'low' | 'medium' | 'high' | 'none'

export type AutoBudgetSuggestion = {
  category: Category
  budget: MonthlyBudget | null
  currentSpent: number
  monthlyProjection: number
  suggestedAmount: number | null
  averageMonthlySpend: number
  maxMonthlySpend: number
  recurringEstimate: number
  confidence: AutoBudgetConfidence
  explanation: string
  hasEnoughData: boolean
}

const monthWindow = 6

function monthKey(value: string) {
  return value.slice(0, 7)
}

function previousMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber, 0).getDate()
}

function elapsedDaysForMonth(month: string) {
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  if (month === currentMonth) return today.getDate()
  return daysInMonth(month)
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

function roundBudget(value: number) {
  if (value <= 0) return 0
  if (value < 1000) return Math.ceil(value / 50) * 50
  return Math.ceil(value / 100) * 100
}

function monthsBetween(from: string, to: string) {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

function recentHistoricalMonths(monthlyTotals: Map<string, number>, selectedMonth: string) {
  return Array.from(monthlyTotals.entries())
    .filter(([month]) => month <= selectedMonth && monthsBetween(month, selectedMonth) < monthWindow)
    .sort(([first], [second]) => first.localeCompare(second))
}

function confidenceExplanation(confidence: AutoBudgetConfidence, recurringEstimate: number, adjustedByRecurring: boolean) {
  const recurringText = adjustedByRecurring
    ? ' Se ajusto para cubrir gastos recurrentes detectados.'
    : recurringEstimate > 0
      ? ' Incluye gastos recurrentes detectados.'
      : ''

  const explanations = {
    very_low: 'Sugerencia basada en pocos dias de uso; puede mejorar cuando registres mas movimientos.',
    low: 'Sugerencia basada en el ritmo actual de gasto del mes.',
    medium: 'Sugerencia basada en el mes actual y datos recientes.',
    high: 'Sugerencia basada en tu historial mensual de gastos.',
    none: 'Sin datos suficientes para sugerir un presupuesto.',
  }

  return `${explanations[confidence]}${recurringText}`
}

function confidenceFor({
  distinctExpenseDays,
  historicalMonthCount,
}: {
  distinctExpenseDays: number
  historicalMonthCount: number
}): AutoBudgetConfidence {
  if (historicalMonthCount >= 2) return 'high'
  if (distinctExpenseDays >= 21) return 'medium'
  if (distinctExpenseDays >= 7) return 'low'
  if (distinctExpenseDays > 0) return 'very_low'
  return 'none'
}

function suggestedAmountFor({
  confidence,
  currentSpent,
  monthlyProjection,
  previousMonthSpent,
  averageMonthlySpend,
  recurringEstimate,
}: {
  confidence: AutoBudgetConfidence
  currentSpent: number
  monthlyProjection: number
  previousMonthSpent: number
  averageMonthlySpend: number
  recurringEstimate: number
}) {
  if (confidence === 'none') return null

  let rawSuggestion = monthlyProjection
  if (confidence === 'medium') {
    rawSuggestion = previousMonthSpent > 0 ? average([monthlyProjection, previousMonthSpent]) : monthlyProjection
  }
  if (confidence === 'high') {
    rawSuggestion = averageMonthlySpend
  }
  if (confidence === 'very_low') {
    rawSuggestion = Math.max(monthlyProjection, currentSpent)
  }

  return roundBudget(Math.max(rawSuggestion, recurringEstimate))
}

export function buildAutoBudgetSuggestions({
  movements,
  categories,
  budgets,
  recurringExpenses,
  month,
}: {
  movements: Movement[]
  categories: Category[]
  budgets: MonthlyBudget[]
  recurringExpenses: RecurringExpense[]
  month: string
}): AutoBudgetSuggestion[] {
  const expenseCategories = categories.filter((category) => category.type === 'expense')
  const expenses = movements
    .filter((movement) => movement.type === 'expense')
    .filter((movement) => Number.isFinite(Number(movement.amount)) && Number(movement.amount) > 0)
  const budgetByCategory = new Map(budgets.map((budget) => [budget.category_id, budget]))
  const selectedMonthExpenses = expenses.filter((movement) => monthKey(movement.date) === month)
  const elapsedDays = Math.max(1, elapsedDaysForMonth(month))
  const previous = previousMonth(month)

  const recurringByCategoryName = new Map<string, number>()
  recurringExpenses.forEach((item) => {
    const key = item.categoryName.toLowerCase()
    recurringByCategoryName.set(key, (recurringByCategoryName.get(key) ?? 0) + item.totalMonthlyEstimate)
  })

  return expenseCategories.map((category) => {
    const categoryExpenses = expenses.filter((movement) => movement.category_id === category.id)
    const currentMonthCategoryExpenses = selectedMonthExpenses.filter((movement) => movement.category_id === category.id)
    const currentSpent = currentMonthCategoryExpenses.reduce((total, movement) => total + Number(movement.amount), 0)
    const distinctExpenseDays = new Set(categoryExpenses.map((movement) => movement.date)).size
    const monthlyTotals = new Map<string, number>()

    categoryExpenses.forEach((movement) => {
      const key = monthKey(movement.date)
      monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + Number(movement.amount))
    })

    const recentMonths = recentHistoricalMonths(monthlyTotals, month)
    const historicalMonthCount = recentMonths.filter(([, total]) => total > 0).length
    const confidence = confidenceFor({ distinctExpenseDays, historicalMonthCount })
    const previousMonthSpent = monthlyTotals.get(previous) ?? 0
    const monthlyProjection = currentSpent > 0 ? (currentSpent / elapsedDays) * 30 : 0
    const monthValues = recentMonths.map(([, total]) => total).filter((total) => total > 0)
    const averageMonthlySpend = average(monthValues)
    const maxMonthlySpend = monthValues.length ? Math.max(...monthValues) : 0
    const recurringEstimate = recurringByCategoryName.get(category.name.toLowerCase()) ?? 0
    const suggestedAmount = suggestedAmountFor({
      confidence,
      currentSpent,
      monthlyProjection,
      previousMonthSpent,
      averageMonthlySpend,
      recurringEstimate,
    })
    const adjustedByRecurring = Boolean(suggestedAmount && recurringEstimate > 0 && suggestedAmount >= recurringEstimate && monthlyProjection < recurringEstimate)

    return {
      category,
      budget: budgetByCategory.get(category.id) ?? null,
      currentSpent,
      monthlyProjection,
      suggestedAmount,
      averageMonthlySpend,
      maxMonthlySpend,
      recurringEstimate,
      confidence,
      explanation: confidenceExplanation(confidence, recurringEstimate, adjustedByRecurring),
      hasEnoughData: confidence !== 'none',
    }
  })
}
