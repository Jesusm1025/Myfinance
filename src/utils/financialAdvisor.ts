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

export type AdvisorResponse = {
  intent: AdvisorIntent
  title: string
  diagnosis: string
  keyNumbers: Array<{ label: string; value: string }>
  recommendation: string
  nextAction: string
}

export type AdvisorIntent =
  | 'overspending'
  | 'debt_priority'
  | 'savings'
  | 'goals'
  | 'purchase'
  | 'reduce_category'
  | 'budget'
  | 'general'

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

export function advisorSuggestedQuestions() {
  return fallbackQuestions
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

export function detectAdvisorIntent(question: string): AdvisorIntent {
  const text = normalize(question)
  if (/(puedo|comprar|gastar|alcanza|conviene).*(rd\$|dop|\$|[0-9])/.test(text)) return 'purchase'
  if (/(deuda|deudas|pagar primero|prioridad|tarjeta)/.test(text)) return 'debt_priority'
  if (/(ahorrar|ahorro|guardar|separar)/.test(text)) return 'savings'
  if (/(meta|metas|objetivo|objetivos)/.test(text)) return 'goals'
  if (/(reducir|bajar|recortar|categoria debo|categoria deberia)/.test(text)) return 'reduce_category'
  if (/(presupuesto|organizar|asignar)/.test(text)) return 'budget'
  if (/(gastando demasiado|gasto demasiado|mayor gasto|exceso|excedi|excedido)/.test(text)) return 'overspending'
  return 'general'
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

export function answerAdvisorQuestion(question: string, data: FinancialAdvisorData): AdvisorResponse {
  const intent = detectAdvisorIntent(question)
  const monthMovements = movementsForMonth(data.movements, data.month)
  const previousMovements = movementsForMonth(data.movements, previousMonth(data.month))
  const income = sumByType(monthMovements, 'income')
  const expenses = sumByType(monthMovements, 'expense')
  const balance = income - expenses
  const previousExpenses = sumByType(previousMovements, 'expense')
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
  const debt = priorityDebt(data.debts)
  const goal = closestSavingsGoal(data.savingsGoals)
  const activeGoals = data.savingsGoals.filter((item) => item.status !== 'cancelled')
  const totalSaved = activeGoals.reduce((total, item) => total + Number(item.current_amount), 0)
  const totalGoalTarget = activeGoals.reduce((total, item) => total + Number(item.target_amount), 0)

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
          ? 'La compra parece posible, siempre que no tengas pagos urgentes fuera de la app.'
          : 'Conviene posponerla o reducir el monto para no presionar el balance del mes.',
      nextAction: alerts.length ? `Antes de comprar, revisa: ${alerts[0].description}` : 'Si decides comprar, registra el movimiento para mantener el presupuesto actualizado.',
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
        ? 'Prioriza deudas vencidas o proximas a vencer. Si hay interes registrado, las de mayor tasa deben recibir atencion adicional.'
        : 'Mantente sin deuda nueva y dirige excedentes a ahorro o metas.',
      nextAction: debt ? `Registra un pago para ${debt.name} o revisa sus cuotas pendientes.` : 'Revisa tus metas de ahorro para asignar el excedente.',
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
        ? 'Separa una parte moderada del balance positivo sin dejar descubiertos gastos recurrentes o deudas.'
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
