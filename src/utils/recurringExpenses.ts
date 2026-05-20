import type { Movement } from '../types/finance'

export type RecurringExpenseConfidence = 'high' | 'medium' | 'low'

export type RecurringExpense = {
  id: string
  name: string
  averageAmount: number
  lastAmount: number
  categoryName: string
  categoryColor: string
  occurrences: number
  months: number
  confidence: RecurringExpenseConfidence
  nextExpectedDate: string
  totalMonthlyEstimate: number
  movementIds: string[]
}

export type RecurringExpensesResult = {
  items: RecurringExpense[]
  totalMonthlyEstimate: number
}

type ExpenseCluster = {
  key: string
  name: string
  categoryName: string
  categoryColor: string
  movements: Movement[]
  averageAmount: number
}

const defaultLookbackMonths = 12
const defaultTolerance = 0.15

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b(?:aut|auth|ref|referencia|aprobacion|num|no|id|transaccion|trx)\b/gi, ' ')
    .replace(/\d{2,}/g, ' ')
    .replace(/[^a-z\s*.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 4)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function movementName(movement: Movement) {
  const source = movement.description?.trim() || movement.category?.name || 'Gasto recurrente'
  const normalized = normalizeText(source)
  return titleCase(normalized || source)
}

function monthKey(value: string) {
  return value.slice(0, 7)
}

function dateValue(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
}

function monthsAgo(months: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setMonth(date.getMonth() - months)
  return date
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

function median(values: number[]) {
  if (!values.length) return 1
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

function relativeDifference(value: number, target: number) {
  if (target <= 0) return 1
  return Math.abs(value - target) / target
}

function canJoinCluster(movement: Movement, cluster: ExpenseCluster, tolerance: number) {
  const amount = Number(movement.amount)
  return relativeDifference(amount, cluster.averageAmount) <= tolerance
}

function createCluster(key: string, movement: Movement): ExpenseCluster {
  return {
    key,
    name: movementName(movement),
    categoryName: movement.category?.name ?? 'Sin categoria',
    categoryColor: movement.category?.color ?? '#64748b',
    movements: [movement],
    averageAmount: Number(movement.amount),
  }
}

function pushToCluster(cluster: ExpenseCluster, movement: Movement) {
  cluster.movements.push(movement)
  cluster.averageAmount = average(cluster.movements.map((item) => Number(item.amount)))
}

function nextExpectedDate(movements: Movement[]) {
  const dates = movements.map((movement) => dateValue(movement.date)).sort((a, b) => a.getTime() - b.getTime())
  const latest = dates[dates.length - 1]
  const expectedDay = median(dates.map((date) => date.getDate()))
  let next = new Date(latest.getFullYear(), latest.getMonth() + 1, expectedDay)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  while (next < today) {
    next = addMonths(next, 1)
  }

  return dateKey(next)
}

function confidenceFor(movements: Movement[], averageAmount: number): RecurringExpenseConfidence {
  const amounts = movements.map((movement) => Number(movement.amount))
  const maxAmountVariance = Math.max(...amounts.map((amount) => relativeDifference(amount, averageAmount)))
  const days = movements.map((movement) => dateValue(movement.date).getDate())
  const medianDay = median(days)
  const maxDayVariance = Math.max(...days.map((day) => Math.abs(day - medianDay)))
  const months = new Set(movements.map((movement) => monthKey(movement.date))).size

  if (months >= 5 && maxAmountVariance <= 0.05 && maxDayVariance <= 5) return 'high'
  if (months >= 4 && maxAmountVariance <= 0.1) return 'medium'
  return 'low'
}

export function detectRecurringExpenses(
  movements: Movement[],
  {
    lookbackMonths = defaultLookbackMonths,
    tolerance = defaultTolerance,
    minMonths = 3,
  }: {
    lookbackMonths?: number
    tolerance?: number
    minMonths?: number
  } = {},
): RecurringExpensesResult {
  const since = monthsAgo(lookbackMonths)
  const source = movements
    .filter((movement) => movement.type === 'expense')
    .filter((movement) => Number.isFinite(Number(movement.amount)) && Number(movement.amount) > 0)
    .filter((movement) => dateValue(movement.date) >= since)
    .sort((a, b) => a.date.localeCompare(b.date))

  const grouped = new Map<string, ExpenseCluster[]>()

  source.forEach((movement) => {
    const normalizedDescription = normalizeText(movement.description ?? movement.category?.name ?? '')
    const descriptionKey = normalizedDescription || normalizeText(movement.category?.name ?? 'sin categoria')
    const categoryKey = movement.category_id ?? 'uncategorized'
    const key = `${descriptionKey}::${categoryKey}`
    const clusters = grouped.get(key) ?? []
    const cluster = clusters.find((item) => canJoinCluster(movement, item, tolerance))

    if (cluster) {
      pushToCluster(cluster, movement)
    } else {
      clusters.push(createCluster(key, movement))
    }

    grouped.set(key, clusters)
  })

  const items = Array.from(grouped.values())
    .flat()
    .map((cluster): RecurringExpense | null => {
      const months = new Set(cluster.movements.map((movement) => monthKey(movement.date)))
      if (months.size < minMonths) return null

      const sortedMovements = [...cluster.movements].sort((a, b) => b.date.localeCompare(a.date))
      const averageAmount = average(cluster.movements.map((movement) => Number(movement.amount)))
      const lastAmount = Number(sortedMovements[0].amount)

      return {
        id: `${cluster.key}::${Math.round(averageAmount * 100)}`,
        name: cluster.name,
        averageAmount,
        lastAmount,
        categoryName: cluster.categoryName,
        categoryColor: cluster.categoryColor,
        occurrences: cluster.movements.length,
        months: months.size,
        confidence: confidenceFor(cluster.movements, averageAmount),
        nextExpectedDate: nextExpectedDate(cluster.movements),
        totalMonthlyEstimate: averageAmount,
        movementIds: cluster.movements.map((movement) => movement.id),
      }
    })
    .filter((item): item is RecurringExpense => Boolean(item))
    .sort((a, b) => {
      const confidenceWeight = { high: 3, medium: 2, low: 1 }
      return (
        confidenceWeight[b.confidence] - confidenceWeight[a.confidence] ||
        b.totalMonthlyEstimate - a.totalMonthlyEstimate ||
        b.occurrences - a.occurrences
      )
    })

  return {
    items,
    totalMonthlyEstimate: items.reduce((total, item) => total + item.totalMonthlyEstimate, 0),
  }
}
