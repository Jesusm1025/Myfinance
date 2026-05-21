import type {
  Account,
  AccountTransfer,
  Category,
  Debt,
  DebtInstallment,
  DebtPayment,
  MonthlyBudget,
  Movement,
  SavingsGoal,
  SavingsGoalContribution,
} from '../types/finance'
import { buildAccountBalances, totalAccountBalance } from './accounts'
import { formatMoney, monthRange } from './format'
import type { RecurringExpense } from './recurringExpenses'
import { buildBudgetSmartAlerts, buildDebtSmartAlerts, sortSmartAlerts } from './smartAlerts'

export type AdvisorInsight = {
  id: string
  label: string
  value: string
  detail: string
  tone: 'positive' | 'warning' | 'danger' | 'neutral'
}

export type AdvisorAutoInsight = {
  id: string
  title: string
  detail: string
  tone: AdvisorInsight['tone']
}

export type AdvisorResponse = {
  intent: AdvisorIntent
  title: string
  diagnosis: string
  keyNumbers: Array<{ label: string; value: string }>
  recommendation: string
  nextAction: string
}

export type AdvisorIntent =
  | 'account_usage'
  | 'budget_health'
  | 'category_growth'
  | 'daily_average'
  | 'debt_health'
  | 'debt_payment_amount'
  | 'debt_payment_scenario'
  | 'overspending'
  | 'debt_priority'
  | 'financial_trend'
  | 'fixed_expenses'
  | 'goal_completion'
  | 'savings'
  | 'spending_vs_last_month'
  | 'goals'
  | 'purchase'
  | 'reduce_category'
  | 'budget'
  | 'general'

export type AdvisorContext = {
  lastIntent?: AdvisorIntent
  lastTopic?: string
  lastDebtId?: string
  lastGoalId?: string
  recentQuestions?: string[]
}

export type FinancialAdvisorData = {
  month: string
  movements: Movement[]
  categories: Category[]
  budgets: MonthlyBudget[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  debtInstallments: DebtInstallment[]
  savingsGoals: SavingsGoal[]
  savingsGoalContributions: SavingsGoalContribution[]
  accounts: Account[]
  accountTransfers: AccountTransfer[]
  recurringExpenses: RecurringExpense[]
}

type CategoryTotal = {
  id: string
  name: string
  color: string
  amount: number
  percent: number
  budget?: MonthlyBudget
}

const fallbackQuestions = [
  'En que estoy gastando demasiado?',
  'Que deuda deberia pagar primero?',
  'Cuanto deberia ahorrar este mes?',
  'Como voy con mis metas?',
  'Puedo gastar RD$1000 este mes?',
  'Que categoria debo reducir?',
]

const quickActionQuestions = [
  { label: 'Reducir gastos', question: 'Que categoria debo reducir?' },
  { label: 'Plan de ahorro', question: 'Cuanto deberia ahorrar este mes?' },
  { label: 'Priorizar deudas', question: 'Que deuda deberia pagar primero?' },
  { label: 'Revisar presupuesto', question: 'Que tan saludable es mi presupuesto?' },
  { label: 'Analizar metas', question: 'Cual meta puedo completar primero?' },
]

export function advisorSuggestedQuestions() {
  return fallbackQuestions
}

export function advisorQuickActions() {
  return quickActionQuestions
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function sumByType(movements: Movement[], type: 'income' | 'expense') {
  return movements
    .filter((movement) => movement.type === type)
    .reduce((total, movement) => total + Number(movement.amount), 0)
}

function movementsForMonth(movements: Movement[], month: string) {
  const range = monthRange(month)
  return movements.filter((movement) => movement.date >= range.from && movement.date <= range.to)
}

function previousMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function daysElapsedInMonth(month: string) {
  const now = new Date()
  const [year, monthNumber] = month.split('-').map(Number)
  if (now.getFullYear() === year && now.getMonth() + 1 === monthNumber) return now.getDate()
  return new Date(year, monthNumber, 0).getDate()
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber, 0).getDate()
}

function categoryTotals(movements: Movement[], categories: Category[], budgets: MonthlyBudget[]): CategoryTotal[] {
  const totalExpenses = sumByType(movements, 'expense')
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const budgetByCategory = new Map(budgets.filter((budget) => budget.category_id).map((budget) => [String(budget.category_id), budget]))
  const totals = new Map<string, CategoryTotal>()

  movements
    .filter((movement) => movement.type === 'expense')
    .forEach((movement) => {
      const key = movement.category_id ?? 'uncategorized'
      const category = movement.category_id ? categoryById.get(movement.category_id) : null
      const current = totals.get(key) ?? {
        id: key,
        name: category?.name ?? movement.category?.name ?? 'Sin categoria',
        color: category?.color ?? movement.category?.color ?? '#64748b',
        amount: 0,
        percent: 0,
        budget: budgetByCategory.get(key),
      }
      current.amount += Number(movement.amount)
      current.percent = totalExpenses > 0 ? (current.amount / totalExpenses) * 100 : 0
      totals.set(key, current)
    })

  return Array.from(totals.values()).sort((a, b) => b.amount - a.amount)
}

function monthExpenseByCategory(movements: Movement[], categories: Category[], month: string) {
  return categoryTotals(movementsForMonth(movements, month), categories, [])
}

function categorySpendForAlerts(movements: Movement[]) {
  const totals = new Map<string, number>()
  movements
    .filter((movement) => movement.type === 'expense' && movement.category_id)
    .forEach((movement) => {
      totals.set(String(movement.category_id), (totals.get(String(movement.category_id)) ?? 0) + Number(movement.amount))
    })
  return Array.from(totals.entries()).map(([categoryId, spent]) => ({ categoryId, spent }))
}

function openDebts(debts: Debt[]) {
  return debts.filter((debt) => debt.status !== 'paid' && Number(debt.outstanding_balance) > 0)
}

function isOverdue(date: string | null | undefined) {
  return Boolean(date && date < new Date().toISOString().slice(0, 10))
}

function daysUntil(date: string | null | undefined) {
  if (!date) return Number.POSITIVE_INFINITY
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function debtPriorityScore(debt: Debt) {
  let score = Number(debt.outstanding_balance) / 1000
  const dueIn = daysUntil(debt.due_date)
  if (debt.status === 'overdue' || isOverdue(debt.due_date)) score += 1000
  else if (dueIn <= 7) score += 500
  else if (dueIn <= 30) score += 150
  score += Number(debt.interest_rate ?? 0) * 10
  score += Number(debt.minimum_payment_dop ?? debt.minimum_payment ?? 0) / 100
  return score
}

function priorityDebt(debts: Debt[]) {
  return openDebts(debts).toSorted((first, second) => debtPriorityScore(second) - debtPriorityScore(first))[0] ?? null
}

function debtByContext(debts: Debt[], context?: AdvisorContext) {
  if (context?.lastDebtId) {
    const debt = debts.find((item) => item.id === context.lastDebtId)
    if (debt) return debt
  }
  return priorityDebt(debts)
}

function savingsGoalProgress(goal: SavingsGoal) {
  const target = Number(goal.target_amount)
  if (target <= 0) return 0
  return Math.min(100, (Number(goal.current_amount) / target) * 100)
}

function closestSavingsGoal(goals: SavingsGoal[]) {
  return goals
    .filter((goal) => goal.status !== 'cancelled' && goal.status !== 'completed')
    .toSorted((first, second) => {
      const firstDate = first.target_date ?? '9999-12-31'
      const secondDate = second.target_date ?? '9999-12-31'
      return firstDate.localeCompare(secondDate)
    })[0] ?? null
}

function extractAmount(question: string) {
  const match = normalize(question).match(/(?:rd\$|dop|\$)?\s*([0-9]+(?:[.,][0-9]{1,2})?)/)
  if (!match) return null
  return Number(match[1].replace(',', '.'))
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function describeChange(change: number) {
  if (Math.abs(change) < 1) return 'se mantuvo practicamente igual'
  return change > 0 ? `subio ${Math.round(change)}%` : `bajo ${Math.abs(Math.round(change))}%`
}

export function detectAdvisorIntent(question: string, context?: AdvisorContext): AdvisorIntent {
  const text = normalize(question)
  if (/(y cuanto|cuanto deberia pagar|cuanto pago|pagarle|abonar|abono)/.test(text) && context?.lastIntent === 'debt_priority') return 'debt_payment_amount'
  if (/(que pasaria|simular|si pago|pago).*(deuda|rd\$|dop|\$|[0-9])/.test(text)) return 'debt_payment_scenario'
  if (/(mas que el mes pasado|comparado con el mes pasado|gaste mas|gasto mas)/.test(text)) return 'spending_vs_last_month'
  if (/(promedio diario|gasto diario|por dia|al dia)/.test(text)) return 'daily_average'
  if (/(endeudado|nivel de deuda|deuda total|salud de deuda)/.test(text)) return 'debt_health'
  if (/(categoria crecio|crecio mas|aumento mas|subio mas)/.test(text)) return 'category_growth'
  if (/(mejorando|voy mejor|peor|tendencia financiera|salud financiera)/.test(text)) return 'financial_trend'
  if (/(gasto fijo|gastos fijos|recurrente|recurrentes|fijo estimado)/.test(text)) return 'fixed_expenses'
  if (/(saludable.*presupuesto|presupuesto.*saludable|estado del presupuesto)/.test(text)) return 'budget_health'
  if (/(meta.*completar primero|completar primero|meta mas cercana|meta puedo completar)/.test(text)) return 'goal_completion'
  if (/(cuenta uso mas|cuenta mas usada|uso de cuenta|cuenta principal)/.test(text)) return 'account_usage'
  if (/(puedo|comprar|gastar|alcanza|conviene).*(rd\$|dop|\$|[0-9])/.test(text)) return 'purchase'
  if (/(deuda|deudas|pagar primero|prioridad|tarjeta)/.test(text)) return 'debt_priority'
  if (/(ahorrar|ahorro|guardar|separar)/.test(text)) return 'savings'
  if (/(meta|metas|objetivo|objetivos)/.test(text)) return 'goals'
  if (/(reducir|bajar|recortar|categoria debo|categoria deberia)/.test(text)) return 'reduce_category'
  if (/(presupuesto|organizar|asignar)/.test(text)) return 'budget'
  if (/(gastando demasiado|gasto demasiado|mayor gasto|exceso|excedi|excedido)/.test(text)) return 'overspending'
  return 'general'
}

export function buildAdvisorAutoInsights(data: FinancialAdvisorData): AdvisorAutoInsight[] {
  const currentMovements = movementsForMonth(data.movements, data.month)
  const currentExpenses = sumByType(currentMovements, 'expense')
  const currentIncome = sumByType(currentMovements, 'income')
  const balance = currentIncome - currentExpenses
  const projectedClose = (balance / Math.max(daysElapsedInMonth(data.month), 1)) * daysInMonth(data.month)
  const categoryGrowth = largestCategoryGrowth(data.movements, data.categories, data.month)
  const budgetAlerts = buildBudgetSmartAlerts({
    budgets: data.budgets,
    categories: data.categories,
    categorySpend: categorySpendForAlerts(currentMovements),
    totalExpenses: currentExpenses,
  })
  const debt = priorityDebt(data.debts)
  const totalDebt = openDebts(data.debts).reduce((total, item) => total + Number(item.outstanding_balance), 0)

  const insights: AdvisorAutoInsight[] = []

  if (categoryGrowth && Math.abs(categoryGrowth.change) >= 10) {
    insights.push({
      id: 'category-growth',
      title: `${categoryGrowth.name} ${describeChange(categoryGrowth.change)}`,
      detail: `Paso de ${formatMoney(categoryGrowth.previous)} a ${formatMoney(categoryGrowth.current)} frente al mes anterior.`,
      tone: categoryGrowth.change > 0 ? 'warning' : 'positive',
    })
  }

  if (budgetAlerts[0]) {
    insights.push({
      id: 'budget-alert',
      title: budgetAlerts[0].title,
      detail: budgetAlerts[0].description,
      tone: budgetAlerts[0].tone === 'danger' ? 'danger' : 'warning',
    })
  }

  insights.push({
    id: 'projected-close',
    title: `Ritmo actual: ${formatMoney(projectedClose)}`,
    detail: projectedClose >= 0
      ? 'Si mantienes este ritmo, cerrarias el mes en positivo.'
      : 'Si mantienes este ritmo, cerrarias el mes en negativo.',
    tone: projectedClose >= 0 ? 'positive' : 'danger',
  })

  if (debt && totalDebt > 0) {
    insights.push({
      id: 'debt-weight',
      title: `${debt.name} concentra ${Math.round((Number(debt.outstanding_balance) / totalDebt) * 100)}% de tus deudas`,
      detail: `Saldo prioritario: ${formatMoney(Number(debt.outstanding_balance))}.`,
      tone: debt.status === 'overdue' || isOverdue(debt.due_date) ? 'danger' : 'warning',
    })
  }

  return insights.slice(0, 4)
}

function largestCategoryGrowth(movements: Movement[], categories: Category[], month: string) {
  const current = monthExpenseByCategory(movements, categories, month)
  const previous = monthExpenseByCategory(movements, categories, previousMonth(month))
  const previousById = new Map(previous.map((item) => [item.id, item.amount]))

  return current
    .map((item) => {
      const previousAmount = previousById.get(item.id) ?? 0
      return {
        id: item.id,
        name: item.name,
        current: item.amount,
        previous: previousAmount,
        change: percentChange(item.amount, previousAmount),
        delta: item.amount - previousAmount,
      }
    })
    .filter((item) => Math.abs(item.delta) > 0)
    .toSorted((first, second) => Math.abs(second.delta) - Math.abs(first.delta))[0] ?? null
}

export function buildAdvisorInsights(data: FinancialAdvisorData): AdvisorInsight[] {
  const monthMovements = movementsForMonth(data.movements, data.month)
  const income = sumByType(monthMovements, 'income')
  const expenses = sumByType(monthMovements, 'expense')
  const balance = income - expenses
  const topCategory = categoryTotals(monthMovements, data.categories, data.budgets)[0]
  const debt = priorityDebt(data.debts)
  const goal = closestSavingsGoal(data.savingsGoals)
  const categorySpend = categorySpendForAlerts(monthMovements)
  const budgetAlerts = buildBudgetSmartAlerts({
    budgets: data.budgets,
    categories: data.categories,
    categorySpend,
    totalExpenses: expenses,
  })
  const compromisedBudget = budgetAlerts[0]

  return [
    {
      id: 'monthly-balance',
      label: 'Balance mensual',
      value: formatMoney(balance),
      detail: `${formatMoney(income)} ingresos - ${formatMoney(expenses)} gastos`,
      tone: balance >= 0 ? 'positive' : 'danger',
    },
    {
      id: 'top-expense',
      label: 'Gasto principal',
      value: topCategory?.name ?? 'Sin gastos',
      detail: topCategory ? `${formatMoney(topCategory.amount)} (${Math.round(topCategory.percent)}% del gasto)` : 'Aun no hay gastos este mes.',
      tone: topCategory && topCategory.percent >= 35 ? 'warning' : 'neutral',
    },
    {
      id: 'priority-debt',
      label: 'Deuda prioritaria',
      value: debt?.name ?? 'Sin deuda abierta',
      detail: debt ? `${formatMoney(Number(debt.outstanding_balance))} pendientes` : 'No hay deudas activas con saldo.',
      tone: debt && (debt.status === 'overdue' || isOverdue(debt.due_date)) ? 'danger' : debt ? 'warning' : 'positive',
    },
    {
      id: 'closest-goal',
      label: 'Meta cercana',
      value: goal?.name ?? 'Sin meta activa',
      detail: goal ? `${Math.round(savingsGoalProgress(goal))}% completado` : 'Crea una meta para recibir seguimiento.',
      tone: goal ? 'neutral' : 'warning',
    },
    {
      id: 'budget-risk',
      label: 'Presupuesto comprometido',
      value: compromisedBudget?.title ?? 'Sin alertas',
      detail: compromisedBudget?.description ?? 'No hay presupuestos excedidos o cerca del limite.',
      tone: compromisedBudget?.tone === 'danger' ? 'danger' : compromisedBudget ? 'warning' : 'positive',
    },
  ]
}

export function answerAdvisorQuestion(question: string, data: FinancialAdvisorData, context?: AdvisorContext): AdvisorResponse {
  const intent = detectAdvisorIntent(question, context)
  const monthMovements = movementsForMonth(data.movements, data.month)
  const previousMovements = movementsForMonth(data.movements, previousMonth(data.month))
  const income = sumByType(monthMovements, 'income')
  const expenses = sumByType(monthMovements, 'expense')
  const balance = income - expenses
  const elapsedDays = Math.max(daysElapsedInMonth(data.month), 1)
  const dailyAverage = expenses / elapsedDays
  const projectedExpenses = dailyAverage * daysInMonth(data.month)
  const previousExpenses = sumByType(previousMovements, 'expense')
  const previousIncome = sumByType(previousMovements, 'income')
  const previousBalance = previousIncome - previousExpenses
  const topCategories = categoryTotals(monthMovements, data.categories, data.budgets)
  const topCategory = topCategories[0]
  const categorySpend = categorySpendForAlerts(monthMovements)
  const alerts = sortSmartAlerts([
    ...buildBudgetSmartAlerts({ budgets: data.budgets, categories: data.categories, categorySpend, totalExpenses: expenses }),
    ...buildDebtSmartAlerts({ debts: data.debts, installments: data.debtInstallments }),
  ])
  const accountBalances = buildAccountBalances(data.accounts, data.movements, data.accountTransfers)
  const totalAccounts = totalAccountBalance(accountBalances)
  const recurringTotal = data.recurringExpenses.reduce((total, item) => total + item.totalMonthlyEstimate, 0)
  const debt = debtByContext(data.debts, context)
  const goal = closestSavingsGoal(data.savingsGoals)
  const activeGoals = data.savingsGoals.filter((item) => item.status !== 'cancelled')
  const totalSaved = activeGoals.reduce((total, item) => total + Number(item.current_amount), 0)
  const totalGoalTarget = activeGoals.reduce((total, item) => total + Number(item.target_amount), 0)
  const openDebtItems = openDebts(data.debts)
  const totalDebt = openDebtItems.reduce((total, item) => total + Number(item.outstanding_balance), 0)
  const growth = largestCategoryGrowth(data.movements, data.categories, data.month)

  if (intent === 'purchase') {
    const amount = extractAmount(question)
    const remainingAfterPurchase = amount == null ? balance : balance - amount
    const canBuy = amount != null && remainingAfterPurchase >= Math.max(0, recurringTotal * 0.25)
    return {
      intent,
      title: amount ? `Compra de ${formatMoney(amount)}` : 'Analisis de compra',
      diagnosis: amount
        ? `Tu balance mensual estimado es ${formatMoney(balance)} y tu balance en cuentas es ${formatMoney(totalAccounts)}.`
        : 'No pude detectar el monto exacto. Escribe algo como: Puedo gastar RD$1000 este mes?',
      keyNumbers: [
        { label: 'Balance mensual', value: formatMoney(balance) },
        { label: 'Balance en cuentas', value: formatMoney(totalAccounts) },
        { label: 'Recurrentes estimados', value: formatMoney(recurringTotal) },
      ],
      recommendation: amount == null
        ? 'Indica un monto para comparar contra tu balance, presupuestos y gastos recurrentes.'
        : canBuy
          ? 'Yo lo veria como una compra posible, pero solo si no compite con una deuda vencida o una meta prioritaria.'
          : 'Mi lectura: mejor posponerla o bajar el monto. La compra dejaria poco margen para cerrar el mes con calma.',
      nextAction: alerts.length ? `Antes de comprar, revisa: ${alerts[0].description}` : 'Si decides comprar, registra el movimiento para mantener el presupuesto actualizado.',
    }
  }

  if (intent === 'spending_vs_last_month') {
    const change = percentChange(expenses, previousExpenses)
    return {
      intent,
      title: 'Comparacion con el mes pasado',
      diagnosis: previousExpenses > 0
        ? `Este mes llevas ${formatMoney(expenses)} en gastos. Frente al mes pasado, tu gasto ${describeChange(change)}.`
        : `Este mes llevas ${formatMoney(expenses)} en gastos. No hay suficiente gasto del mes anterior para comparar con precision.`,
      keyNumbers: [
        { label: 'Gasto actual', value: formatMoney(expenses) },
        { label: 'Mes anterior', value: formatMoney(previousExpenses) },
        { label: 'Cambio', value: `${Math.round(change)}%` },
      ],
      recommendation: change > 10
        ? 'Hay una subida visible. Revisa primero las categorias que mas crecieron antes de recortar todo por igual.'
        : change < -10
          ? 'Vas mejor que el mes pasado. Mantener este ritmo te daria mas margen para ahorro o deuda.'
          : 'El gasto esta bastante estable. La oportunidad esta en optimizar categorias puntuales.',
      nextAction: growth ? `Empieza por ${growth.name}, que tuvo el cambio mas fuerte.` : 'Compara tus categorias principales en Reportes.',
    }
  }

  if (intent === 'daily_average') {
    return {
      intent,
      title: 'Gasto promedio diario',
      diagnosis: `Tu ritmo actual es de ${formatMoney(dailyAverage)} por dia. Si no cambia, proyecta ${formatMoney(projectedExpenses)} en gastos al cierre del mes.`,
      keyNumbers: [
        { label: 'Gasto del mes', value: formatMoney(expenses) },
        { label: 'Promedio diario', value: formatMoney(dailyAverage) },
        { label: 'Proyeccion mensual', value: formatMoney(projectedExpenses) },
      ],
      recommendation: projectedExpenses > income
        ? 'Con este ritmo podrias superar tus ingresos. Conviene poner un limite diario temporal.'
        : 'El ritmo diario luce manejable frente a tus ingresos actuales.',
      nextAction: topCategory ? `Controla ${topCategory.name}, porque pesa ${Math.round(topCategory.percent)}% del gasto mensual.` : 'Registra algunos gastos mas para afinar el promedio.',
    }
  }

  if (intent === 'debt_health') {
    const debtToAccounts = totalAccounts > 0 ? (totalDebt / totalAccounts) * 100 : 0
    return {
      intent,
      title: 'Nivel de endeudamiento',
      diagnosis: totalDebt > 0
        ? `Tienes ${formatMoney(totalDebt)} en deudas abiertas. La mas pesada es ${debt?.name ?? 'una deuda pendiente'}.`
        : 'No veo deudas abiertas con saldo pendiente.',
      keyNumbers: [
        { label: 'Deuda total', value: formatMoney(totalDebt) },
        { label: 'Deudas abiertas', value: String(openDebtItems.length) },
        { label: 'Deuda / cuentas', value: totalAccounts > 0 ? `${Math.round(debtToAccounts)}%` : 'Sin base' },
      ],
      recommendation: totalDebt > totalAccounts
        ? 'La deuda supera tu balance en cuentas. Yo priorizaria pagos pequenos pero constantes antes de asumir gastos nuevos.'
        : 'La deuda esta presente, pero no parece dominar todo tu balance disponible.',
      nextAction: debt ? `Usa ${debt.name} como foco principal y define un pago fijo este mes.` : 'Mantente sin deuda nueva y dirige excedentes a ahorro.',
    }
  }

  if (intent === 'debt_payment_amount' || intent === 'debt_payment_scenario') {
    const amount = extractAmount(question)
    const selectedDebt = debt
    const balanceLeft = selectedDebt ? Math.max(Number(selectedDebt.outstanding_balance) - (amount ?? 0), 0) : 0
    const minimum = selectedDebt ? Number(selectedDebt.minimum_payment_dop ?? selectedDebt.minimum_payment ?? 0) : 0
    const suggested = selectedDebt
      ? Math.max(minimum, Math.min(Number(selectedDebt.outstanding_balance), Math.max(balance * 0.35, Number(selectedDebt.outstanding_balance) * 0.08)))
      : 0
    return {
      intent,
      title: selectedDebt ? `Pago para ${selectedDebt.name}` : 'Simulacion de pago',
      diagnosis: selectedDebt
        ? amount
          ? `Si pagas ${formatMoney(amount)}, el saldo bajaria de ${formatMoney(Number(selectedDebt.outstanding_balance))} a ${formatMoney(balanceLeft)}.`
          : `Para esta deuda, yo empezaria con un pago sugerido de ${formatMoney(suggested)}.`
        : 'No encontre una deuda abierta para simular. Preguntame primero que deuda deberias pagar.',
      keyNumbers: [
        { label: 'Saldo actual', value: selectedDebt ? formatMoney(Number(selectedDebt.outstanding_balance)) : formatMoney(0) },
        { label: amount ? 'Saldo posterior' : 'Pago sugerido', value: amount ? formatMoney(balanceLeft) : formatMoney(suggested) },
        { label: 'Pago minimo', value: minimum ? formatMoney(minimum) : 'No registrado' },
      ],
      recommendation: selectedDebt
        ? 'Si hay mora o vencimiento, paga al menos el minimo y suma cualquier excedente posible a capital.'
        : 'Necesito una deuda de referencia para recomendar monto.',
      nextAction: selectedDebt ? `Registra el pago en ${selectedDebt.name} y evita duplicarlo como gasto si ya lo vinculas a movimientos.` : 'Pregunta: Que deuda deberia pagar primero?',
    }
  }

  if (intent === 'category_growth') {
    return {
      intent,
      title: 'Categoria que mas cambio',
      diagnosis: growth
        ? `${growth.name} fue la categoria con mayor variacion: ${describeChange(growth.change)} frente al mes anterior.`
        : 'No hay suficiente historial por categoria para detectar crecimiento.',
      keyNumbers: [
        { label: 'Actual', value: growth ? formatMoney(growth.current) : formatMoney(0) },
        { label: 'Anterior', value: growth ? formatMoney(growth.previous) : formatMoney(0) },
        { label: 'Cambio', value: growth ? `${Math.round(growth.change)}%` : 'Sin datos' },
      ],
      recommendation: growth && growth.change > 0
        ? 'Revisa si fue un gasto puntual o un nuevo patron. Si se repetira, ajusta presupuesto.'
        : 'Si la categoria bajo, manten el habito que produjo esa mejora.',
      nextAction: growth ? `Filtra movimientos por ${growth.name} para ver que lo disparo.` : 'Necesitas al menos dos meses con gastos para esta lectura.',
    }
  }

  if (intent === 'financial_trend') {
    const balanceChange = balance - previousBalance
    return {
      intent,
      title: 'Tendencia financiera',
      diagnosis: balanceChange >= 0
        ? `Vas mejorando: tu balance mensual esta ${formatMoney(balanceChange)} por encima del mes anterior.`
        : `Hay deterioro frente al mes anterior: el balance bajo ${formatMoney(Math.abs(balanceChange))}.`,
      keyNumbers: [
        { label: 'Balance actual', value: formatMoney(balance) },
        { label: 'Balance anterior', value: formatMoney(previousBalance) },
        { label: 'Diferencia', value: formatMoney(balanceChange) },
      ],
      recommendation: balanceChange >= 0
        ? 'Buen rumbo. Conviene convertir parte de esa mejora en ahorro o pago de deuda.'
        : 'No parece grave por si solo, pero revisa si el cambio viene de gasto recurrente o deuda.',
      nextAction: growth ? `La pista mas fuerte esta en ${growth.name}.` : 'Compara ingresos y gastos en Reportes.',
    }
  }

  if (intent === 'fixed_expenses') {
    return {
      intent,
      title: 'Gasto fijo estimado',
      diagnosis: data.recurringExpenses.length
        ? `Detecte ${data.recurringExpenses.length} gasto(s) recurrente(s), con estimado mensual de ${formatMoney(recurringTotal)}.`
        : 'Todavia no hay suficientes patrones para estimar gastos fijos con confianza.',
      keyNumbers: [
        { label: 'Estimado fijo', value: formatMoney(recurringTotal) },
        { label: 'Patrones', value: String(data.recurringExpenses.length) },
        { label: 'Peso sobre ingresos', value: income > 0 ? `${Math.round((recurringTotal / income) * 100)}%` : 'Sin ingresos' },
      ],
      recommendation: recurringTotal > income * 0.4
        ? 'Tus fijos podrian estar pesando demasiado. Busca suscripciones, servicios o pagos repetidos que puedas renegociar.'
        : 'El gasto fijo estimado luce manejable, pero mantenlo vigilado.',
      nextAction: data.recurringExpenses[0] ? `Revisa primero ${data.recurringExpenses[0].name}.` : 'Registra movimientos por unos meses para mejorar la deteccion.',
    }
  }

  if (intent === 'budget_health') {
    const budgetAlerts = alerts.filter((alert) => alert.id.includes('budget'))
    const totalBudget = data.budgets.reduce((total, item) => total + Number(item.amount), 0)
    const usedPercent = totalBudget > 0 ? (expenses / totalBudget) * 100 : 0
    return {
      intent,
      title: 'Salud del presupuesto',
      diagnosis: totalBudget > 0
        ? `Has usado aproximadamente ${Math.round(usedPercent)}% del presupuesto registrado para el mes.`
        : 'No veo un presupuesto mensual suficiente para medir salud con precision.',
      keyNumbers: [
        { label: 'Presupuesto total', value: formatMoney(totalBudget) },
        { label: 'Gasto actual', value: formatMoney(expenses) },
        { label: 'Alertas', value: String(budgetAlerts.length) },
      ],
      recommendation: budgetAlerts.length
        ? 'Hay categorias cerca del limite o excedidas. Mejor hacer ajustes puntuales, no recortes generales.'
        : 'El presupuesto luce estable por ahora.',
      nextAction: budgetAlerts[0]?.description ?? 'Revisa Presupuestos para aplicar sugerencias automaticas donde falte historial.',
    }
  }

  if (intent === 'goal_completion') {
    const goalByCompletion = activeGoals
      .filter((item) => item.status !== 'completed')
      .toSorted((a, b) => (Number(a.target_amount) - Number(a.current_amount)) - (Number(b.target_amount) - Number(b.current_amount)))[0]
    const remaining = goalByCompletion ? Math.max(Number(goalByCompletion.target_amount) - Number(goalByCompletion.current_amount), 0) : 0
    return {
      intent,
      title: 'Meta mas facil de completar',
      diagnosis: goalByCompletion
        ? `${goalByCompletion.name} parece la meta mas cercana por monto restante.`
        : 'No hay metas activas pendientes de completar.',
      keyNumbers: [
        { label: 'Meta', value: goalByCompletion?.name ?? 'Sin meta' },
        { label: 'Falta', value: formatMoney(remaining) },
        { label: 'Progreso', value: goalByCompletion ? `${Math.round(savingsGoalProgress(goalByCompletion))}%` : '0%' },
      ],
      recommendation: goalByCompletion && balance > 0
        ? 'Si quieres una victoria rapida, dirige una parte del balance positivo a esta meta.'
        : 'Primero libera balance mensual antes de forzar aportes.',
      nextAction: goalByCompletion ? `Evalua aportar a ${goalByCompletion.name}.` : 'Crea una meta pequeña y medible.',
    }
  }

  if (intent === 'account_usage') {
    const accountUse = accountBalances
      .map((account) => ({
        ...account,
        movementCount: data.movements.filter((movement) => movement.account_id === account.id).length,
      }))
      .toSorted((a, b) => b.movementCount - a.movementCount)[0]
    return {
      intent,
      title: 'Cuenta mas usada',
      diagnosis: accountUse
        ? `${accountUse.name} es la cuenta con mas movimientos registrados.`
        : 'No hay cuentas con movimientos suficientes para medir uso.',
      keyNumbers: [
        { label: 'Cuenta', value: accountUse?.name ?? 'Sin cuenta' },
        { label: 'Movimientos', value: String(accountUse?.movementCount ?? 0) },
        { label: 'Balance', value: accountUse ? formatMoney(accountUse.balance) : formatMoney(0) },
      ],
      recommendation: accountUse
        ? 'Usala como cuenta de referencia para revisar flujo real y detectar gastos frecuentes.'
        : 'Asocia movimientos a cuentas para tener esta lectura.',
      nextAction: 'Ve a Cuentas para comparar saldos y transferencias.',
    }
  }

  if (intent === 'debt_priority') {
    return {
      intent,
      title: 'Prioridad de deudas',
      diagnosis: debt
        ? `La deuda que deberias mirar primero es ${debt.name}.`
        : 'No hay deudas abiertas con saldo pendiente.',
      keyNumbers: [
        { label: 'Saldo prioritario', value: debt ? formatMoney(Number(debt.outstanding_balance)) : formatMoney(0) },
        { label: 'Vencimiento', value: debt?.due_date ?? 'Sin fecha' },
        { label: 'Deudas abiertas', value: String(openDebts(data.debts).length) },
      ],
      recommendation: debt
        ? 'Mi recomendacion: prioriza vencidas o proximas a vencer. Si hay interes registrado, la tasa alta pesa mas que el monto pequeno.'
        : 'Mantente sin deuda nueva y dirige excedentes a ahorro o metas.',
      nextAction: debt ? `Puedes preguntarme "y cuanto deberia pagar" para estimar un monto prudente para ${debt.name}.` : 'Revisa tus metas de ahorro para asignar el excedente.',
    }
  }

  if (intent === 'savings') {
    const suggestedSavings = Math.max(0, Math.min(balance * 0.3, balance - recurringTotal * 0.25))
    return {
      intent,
      title: 'Ahorro sugerido del mes',
      diagnosis: balance > 0
        ? `Tienes un balance positivo de ${formatMoney(balance)} este mes.`
        : `El balance mensual esta en ${formatMoney(balance)}, asi que ahorrar ahora puede ser dificil.`,
      keyNumbers: [
        { label: 'Balance mensual', value: formatMoney(balance) },
        { label: 'Ahorro sugerido', value: formatMoney(suggestedSavings) },
        { label: 'Metas activas', value: String(activeGoals.filter((item) => item.status !== 'completed').length) },
      ],
      recommendation: suggestedSavings > 0
        ? 'Yo separaria una parte moderada del balance positivo, sin dejar descubiertos gastos recurrentes o deudas.'
        : 'Primero busca liberar flujo reduciendo categorias altas o pagos no urgentes.',
      nextAction: goal ? `Puedes aportar a "${goal.name}" para avanzar desde ${Math.round(savingsGoalProgress(goal))}%.` : 'Crea una meta de ahorro para darle destino al excedente.',
    }
  }

  if (intent === 'goals') {
    const progress = totalGoalTarget > 0 ? (totalSaved / totalGoalTarget) * 100 : 0
    return {
      intent,
      title: 'Estado de tus metas',
      diagnosis: activeGoals.length
        ? `Has acumulado ${formatMoney(totalSaved)} de ${formatMoney(totalGoalTarget)} en metas activas.`
        : 'Todavia no tienes metas de ahorro activas.',
      keyNumbers: [
        { label: 'Progreso general', value: `${Math.round(progress)}%` },
        { label: 'Meta mas cercana', value: goal?.name ?? 'Sin meta' },
        { label: 'Aportes registrados', value: String(data.savingsGoalContributions.length) },
      ],
      recommendation: goal
        ? 'Da prioridad a la meta mas cercana si su fecha objetivo esta proxima.'
        : 'Crea una meta inicial pequena para empezar a medir progreso.',
      nextAction: goal ? `Revisa si puedes hacer un aporte a ${goal.name} este mes.` : 'Empieza con fondo de emergencia o ahorro mensual.',
    }
  }

  if (intent === 'reduce_category' || intent === 'overspending') {
    const overBudget = topCategories.find((category) => category.budget && category.amount > Number(category.budget.amount))
    const target = overBudget ?? topCategory
    return {
      intent,
      title: intent === 'reduce_category' ? 'Categoria a reducir' : 'Gastos altos detectados',
      diagnosis: target
        ? `${target.name} concentra ${formatMoney(target.amount)} este mes (${Math.round(target.percent)}% de tus gastos).`
        : 'No hay gastos suficientes este mes para detectar excesos.',
      keyNumbers: [
        { label: 'Gasto principal', value: target ? formatMoney(target.amount) : formatMoney(0) },
        { label: 'Porcentaje del gasto', value: target ? `${Math.round(target.percent)}%` : '0%' },
        { label: 'Gasto mes anterior', value: formatMoney(previousExpenses) },
      ],
      recommendation: target
        ? target.budget && target.amount > Number(target.budget.amount)
          ? `Reduce ${target.name} o actualiza el presupuesto si el monto realista cambio.`
          : `Empieza revisando ${target.name}, porque es la categoria con mayor peso este mes.`
        : 'Registra mas movimientos para obtener un diagnostico mas preciso.',
      nextAction: target ? `Mira los ultimos movimientos de ${target.name} y elimina o pospone compras no esenciales.` : 'Agrega categorias y movimientos para mejorar el analisis.',
    }
  }

  if (intent === 'budget') {
    const budgetAlerts = alerts.filter((alert) => alert.id.includes('budget'))
    return {
      intent,
      title: 'Organizacion de presupuesto',
      diagnosis: budgetAlerts.length
        ? `Hay ${budgetAlerts.length} alerta(s) de presupuesto este mes.`
        : 'No se detectan presupuestos excedidos o cerca del limite.',
      keyNumbers: [
        { label: 'Ingresos', value: formatMoney(income) },
        { label: 'Gastos', value: formatMoney(expenses) },
        { label: 'Balance', value: formatMoney(balance) },
      ],
      recommendation: topCategory
        ? `Asigna primero presupuesto a ${topCategory.name}, luego cubre recurrentes y deudas proximas.`
        : 'Usa presupuesto automatico para iniciar con sugerencias por categoria.',
      nextAction: 'Ve a Presupuestos y aplica sugerencias automaticas solo en las categorias que quieras controlar.',
    }
  }

  return {
    intent,
    title: 'Resumen financiero',
    diagnosis: `Este mes llevas ${formatMoney(income)} en ingresos y ${formatMoney(expenses)} en gastos.`,
    keyNumbers: [
      { label: 'Balance mensual', value: formatMoney(balance) },
      { label: 'Balance en cuentas', value: formatMoney(totalAccounts) },
      { label: 'Alertas activas', value: String(alerts.length) },
    ],
    recommendation: alerts[0]?.description ?? 'Mantener registros frecuentes mejora las recomendaciones del asesor.',
    nextAction: topCategory ? `Revisa ${topCategory.name}, tu categoria con mayor gasto del mes.` : 'Registra movimientos para recibir recomendaciones mas especificas.',
  }
}
