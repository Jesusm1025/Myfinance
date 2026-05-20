import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, PiggyBank } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { BudgetPanel } from '../components/BudgetPanel'
import { EmptyState } from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'
import { StatusMessage } from '../components/StatusMessage'
import { budgetsChangedEvent, categoriesChangedEvent, movementsChangedEvent } from '../events/financeEvents'
import { listCategories, listMonthlyBudgets, listMovements } from '../services/accounting'
import type { Category, MonthlyBudget, Movement, MovementFilters } from '../types/finance'
import { currentMonthValue, monthRange } from '../utils/format'

const baseFilters: MovementFilters = {
  month: currentMonthValue(),
  type: 'all',
  categoryId: '',
  accountId: '',
  paymentMethod: 'all',
  from: '',
  to: '',
}

function sumExpenses(movements: Movement[]) {
  return movements
    .filter((movement) => movement.type === 'expense')
    .reduce((total, movement) => total + Number(movement.amount), 0)
}

export function BudgetsPage() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonthValue())
  const [movements, setMovements] = useState<Movement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadBudgets = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')

    try {
      const [movementData, categoryData, budgetData] = await Promise.all([
        listMovements(user.id, { ...baseFilters, month, ...monthRange(month) }),
        listCategories(user.id),
        listMonthlyBudgets(user.id, month).catch(() => [] as MonthlyBudget[]),
      ])
      setMovements(movementData)
      setCategories(categoryData)
      setBudgets(budgetData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los presupuestos.')
    } finally {
      setLoading(false)
    }
  }, [month, user])

  useEffect(() => {
    void loadBudgets()
  }, [loadBudgets])

  useEffect(() => {
    window.addEventListener(movementsChangedEvent, loadBudgets)
    window.addEventListener(categoriesChangedEvent, loadBudgets)
    window.addEventListener(budgetsChangedEvent, loadBudgets)
    return () => {
      window.removeEventListener(movementsChangedEvent, loadBudgets)
      window.removeEventListener(categoriesChangedEvent, loadBudgets)
      window.removeEventListener(budgetsChangedEvent, loadBudgets)
    }
  }, [loadBudgets])

  const totalExpenses = useMemo(() => sumExpenses(movements), [movements])
  const categorySpend = useMemo(() => {
    const totals = new Map<string, number>()
    movements
      .filter((movement) => movement.type === 'expense')
      .forEach((movement) => {
        if (!movement.category_id) return
        totals.set(movement.category_id, (totals.get(movement.category_id) ?? 0) + Number(movement.amount))
      })

    return Array.from(totals.entries()).map(([categoryId, spent]) => ({ categoryId, spent }))
  }, [movements])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100">
            Presupuestos
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
            Control mensual de gastos
          </h2>
        </div>
        <label className="w-full sm:w-56">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mes visible</span>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-brand-500/20"
          />
        </label>
      </div>

      {error ? <StatusMessage message={error} /> : null}

      {loading ? (
        <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center gap-3">
            <SkeletonList rows={1} itemHeight="h-10 w-10" />
            <div className="space-y-2">
              <SkeletonList rows={2} itemHeight="h-4 w-40" />
            </div>
          </div>
          <div className="mt-5">
            <SkeletonList rows={3} itemHeight="h-28" />
          </div>
        </section>
      ) : user ? (
        <BudgetPanel
          userId={user.id}
          month={month}
          categories={categories}
          budgets={budgets}
          categorySpend={categorySpend}
          totalExpenses={totalExpenses}
          onChanged={loadBudgets}
        />
      ) : (
        <EmptyState title="Inicia sesion" detail="Tus presupuestos se cargaran al entrar con tu cuenta." />
      )}

      {!loading && !categories.some((category) => category.type === 'expense') ? (
        <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
              <PiggyBank className="h-5 w-5" />
            </div>
            <EmptyState
              title="Sin categorias de gasto"
              detail="Crea categorias de gasto para asignar presupuestos por categoria."
            />
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-line bg-white p-4 text-sm text-muted shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gold-50 p-2 text-gold-500 dark:bg-gold-500/15">
            <CalendarRange className="h-5 w-5" />
          </div>
          <p>
            Los presupuestos se guardan por usuario y por mes. Las alertas aparecen al llegar al 80% y al superar el monto definido.
          </p>
        </div>
      </section>
    </div>
  )
}
