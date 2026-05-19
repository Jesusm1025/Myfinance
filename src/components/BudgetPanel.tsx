import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Save, Trash2, WalletCards } from 'lucide-react'
import clsx from 'clsx'
import type { Category, MonthlyBudget } from '../types/finance'
import { deleteMonthlyBudget, saveMonthlyBudget } from '../services/accounting'
import { formatMoney } from '../utils/format'
import { StatusMessage } from './StatusMessage'

type CategorySpend = {
  categoryId: string
  spent: number
}

type BudgetStatus = 'empty' | 'ok' | 'warning' | 'over'

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20'

function percentUsed(spent: number, budget?: MonthlyBudget) {
  if (!budget || Number(budget.amount) <= 0) return 0
  return Math.round((spent / Number(budget.amount)) * 100)
}

function budgetStatus(percent: number, budget?: MonthlyBudget): BudgetStatus {
  if (!budget) return 'empty'
  if (percent >= 100) return 'over'
  if (percent >= 80) return 'warning'
  return 'ok'
}

function statusLabel(status: BudgetStatus) {
  const labels = {
    empty: 'Sin presupuesto',
    ok: 'En control',
    warning: 'Alerta 80%',
    over: 'Presupuesto superado',
  }
  return labels[status]
}

function progressClass(status: BudgetStatus) {
  const classes = {
    empty: 'bg-slate-300 dark:bg-slate-700',
    ok: 'bg-brand-600',
    warning: 'bg-gold-500',
    over: 'bg-coral-600',
  }
  return classes[status]
}

export function BudgetPanel({
  userId,
  month,
  categories,
  budgets,
  categorySpend,
  totalExpenses,
  onChanged,
}: {
  userId: string
  month: string
  categories: Category[]
  budgets: MonthlyBudget[]
  categorySpend: CategorySpend[]
  totalExpenses: number
  onChanged: () => Promise<void> | void
}) {
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories],
  )
  const generalBudget = budgets.find((budget) => !budget.category_id)
  const budgetByCategory = useMemo(() => new Map(budgets.map((budget) => [budget.category_id, budget])), [budgets])
  const spendByCategory = useMemo(
    () => new Map(categorySpend.map((item) => [item.categoryId, item.spent])),
    [categorySpend],
  )
  const [generalValue, setGeneralValue] = useState('')
  const [categoryValues, setCategoryValues] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setGeneralValue(generalBudget ? String(generalBudget.amount) : '')
    setCategoryValues(
      Object.fromEntries(
        expenseCategories.map((category) => {
          const budget = budgetByCategory.get(category.id)
          return [category.id, budget ? String(budget.amount) : '']
        }),
      ),
    )
  }, [budgetByCategory, expenseCategories, generalBudget])

  const generalPercent = percentUsed(totalExpenses, generalBudget)
  const generalStatus = budgetStatus(generalPercent, generalBudget)
  const overBudgetCount = budgets.filter((budget) => {
    const spent = budget.category_id ? spendByCategory.get(budget.category_id) ?? 0 : totalExpenses
    return budgetStatus(percentUsed(spent, budget), budget) === 'over'
  }).length
  const warningCount = budgets.filter((budget) => {
    const spent = budget.category_id ? spendByCategory.get(budget.category_id) ?? 0 : totalExpenses
    return budgetStatus(percentUsed(spent, budget), budget) === 'warning'
  }).length

  async function saveBudget(categoryId: string | null, amount: string) {
    const id = categoryId ?? 'general'
    const existing = budgets.find((budget) => budget.category_id === categoryId)
    setSavingId(id)
    setError('')
    setSuccess('')
    try {
      await saveMonthlyBudget(userId, {
        id: existing?.id,
        month,
        category_id: categoryId,
        amount,
      })
      setSuccess('Presupuesto guardado correctamente.')
      await onChanged()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el presupuesto.')
    } finally {
      setSavingId(null)
    }
  }

  async function removeBudget(categoryId: string | null) {
    const existing = budgets.find((budget) => budget.category_id === categoryId)
    if (!existing) return
    const id = categoryId ?? 'general'
    setSavingId(id)
    setError('')
    setSuccess('')
    try {
      await deleteMonthlyBudget(userId, existing.id)
      setSuccess('Presupuesto eliminado correctamente.')
      await onChanged()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el presupuesto.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="rounded-lg border border-line bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-line p-4 dark:border-slate-800 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
              <WalletCards className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Presupuestos del mes</h3>
              <p className="text-sm text-muted dark:text-slate-400">
                Controla el gasto general y por categoria para {month}.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {warningCount ? <BudgetPill status="warning" text={`${warningCount} en 80%`} /> : null}
            {overBudgetCount ? <BudgetPill status="over" text={`${overBudgetCount} superado`} /> : null}
            {!warningCount && !overBudgetCount ? <BudgetPill status="ok" text="Sin alertas" /> : null}
          </div>
        </div>
        {error ? <div className="mt-4"><StatusMessage message={error} /></div> : null}
        {success ? <div className="mt-4"><StatusMessage message={success} variant="success" /></div> : null}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-lg border border-line p-4 dark:border-slate-800">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto] lg:items-end">
            <BudgetProgress
              title="Presupuesto general"
              spent={totalExpenses}
              budget={generalBudget}
              percent={generalPercent}
              status={generalStatus}
            />
            <label>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Monto mensual</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={generalValue}
                onChange={(event) => setGeneralValue(event.target.value)}
                className={`mt-1 ${fieldClass}`}
                placeholder="0.00"
              />
            </label>
            <BudgetActions
              canDelete={Boolean(generalBudget)}
              saving={savingId === 'general'}
              onSave={() => void saveBudget(null, generalValue)}
              onDelete={() => void removeBudget(null)}
            />
          </div>
        </div>

        <div className="grid gap-3">
          {expenseCategories.map((category) => {
            const budget = budgetByCategory.get(category.id)
            const spent = spendByCategory.get(category.id) ?? 0
            const percent = percentUsed(spent, budget)
            const status = budgetStatus(percent, budget)
            return (
              <article key={category.id} className="rounded-lg border border-line p-4 dark:border-slate-800">
                <div className="grid gap-4 xl:grid-cols-[1fr_220px_auto] xl:items-end">
                  <BudgetProgress
                    title={category.name}
                    spent={spent}
                    budget={budget}
                    percent={percent}
                    status={status}
                    color={category.color}
                  />
                  <label>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Presupuesto
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={categoryValues[category.id] ?? ''}
                      onChange={(event) =>
                        setCategoryValues((current) => ({ ...current, [category.id]: event.target.value }))
                      }
                      className={`mt-1 ${fieldClass}`}
                      placeholder="0.00"
                    />
                  </label>
                  <BudgetActions
                    canDelete={Boolean(budget)}
                    saving={savingId === category.id}
                    onSave={() => void saveBudget(category.id, categoryValues[category.id] ?? '')}
                    onDelete={() => void removeBudget(category.id)}
                  />
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function BudgetPill({ status, text }: { status: Exclude<BudgetStatus, 'empty'>; text: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1',
        status === 'ok' && 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100',
        status === 'warning' && 'bg-gold-50 text-gold-500 dark:bg-gold-500/15',
        status === 'over' && 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400',
      )}
    >
      {status === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {text}
    </span>
  )
}

function BudgetProgress({
  title,
  spent,
  budget,
  percent,
  status,
  color,
}: {
  title: string
  spent: number
  budget?: MonthlyBudget
  percent: number
  status: BudgetStatus
  color?: string
}) {
  const visiblePercent = Math.min(percent, 100)

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {color ? <span className="h-9 w-9 rounded-lg" style={{ backgroundColor: color }} /> : null}
          <div className="min-w-0">
            <h4 className="truncate font-semibold">{title}</h4>
            <p className="text-sm text-muted dark:text-slate-400">
              {formatMoney(spent)} gastados{budget ? ` de ${formatMoney(Number(budget.amount))}` : ''}
            </p>
          </div>
        </div>
        <BudgetPill status={status === 'empty' ? 'ok' : status} text={statusLabel(status)} />
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={clsx('h-full rounded-full transition-all', progressClass(status))}
          style={{ width: `${budget ? visiblePercent : 0}%` }}
        />
      </div>
      <p
        className={clsx(
          'mt-2 text-sm font-semibold',
          status === 'ok' && 'text-brand-700 dark:text-brand-100',
          status === 'warning' && 'text-gold-500',
          status === 'over' && 'text-coral-600 dark:text-coral-400',
          status === 'empty' && 'text-muted dark:text-slate-400',
        )}
      >
        {budget ? `${percent}% consumido` : 'Define un presupuesto para activar el seguimiento.'}
      </p>
    </div>
  )
}

function BudgetActions({
  canDelete,
  saving,
  onSave,
  onDelete,
}: {
  canDelete: boolean
  saving: boolean
  onSave: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 xl:flex-none"
      >
        <Save className="h-4 w-4" />
        Guardar
      </button>
      {canDelete ? (
        <button
          type="button"
          disabled={saving}
          onClick={onDelete}
          className="inline-flex items-center justify-center rounded-lg border border-line px-3 py-2.5 text-coral-600 hover:bg-coral-50 disabled:opacity-60 dark:border-slate-700 dark:text-coral-400 dark:hover:bg-coral-500/10"
          aria-label="Eliminar presupuesto"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}
