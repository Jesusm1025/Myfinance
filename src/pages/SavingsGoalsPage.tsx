import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Target, TrendingUp, Wallet } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState } from '../components/EmptyState'
import { SavingsGoalCard, savingsGoalProgress } from '../components/SavingsGoalCard'
import { SavingsGoalForm } from '../components/SavingsGoalForm'
import { SkeletonList, SkeletonStats } from '../components/Skeleton'
import { StatCard } from '../components/StatCard'
import { StatusMessage } from '../components/StatusMessage'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { accountsChangedEvent, savingsGoalsChangedEvent } from '../events/financeEvents'
import { deleteSavingsGoal, listAccounts, listSavingsGoals, saveSavingsGoal, updateSavingsGoalStatus } from '../services/accounting'
import type { Account, SavingsGoal, SavingsGoalFormValues } from '../types/finance'
import { formatCurrencyAmount, getActiveCurrency } from '../utils/currency'

const initialGoal: SavingsGoalFormValues = {
  account_id: '',
  name: '',
  description: '',
  target_amount: '',
  current_amount: '0',
  currency: getActiveCurrency(),
  goal_type: 'custom',
  target_date: '',
  monthly_target: '',
  status: 'active',
  color: '#198c7c',
  icon: 'target',
}

function goalToForm(goal: SavingsGoal): SavingsGoalFormValues {
  return {
    id: goal.id,
    account_id: goal.account_id ?? '',
    name: goal.name,
    description: goal.description ?? '',
    target_amount: String(goal.target_amount),
    current_amount: String(goal.current_amount),
    currency: goal.currency,
    goal_type: goal.goal_type,
    target_date: goal.target_date ?? '',
    monthly_target: goal.monthly_target === null ? '' : String(goal.monthly_target),
    status: goal.status,
    color: goal.color,
    icon: goal.icon ?? '',
  }
}

function totalInActiveCurrency(goals: SavingsGoal[], field: 'current_amount' | 'target_amount') {
  const currency = getActiveCurrency()
  return goals
    .filter((goal) => goal.currency === currency)
    .reduce((total, goal) => total + Number(goal[field]), 0)
}

export function SavingsGoalsPage() {
  const { user } = useAuth()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [values, setValues] = useState<SavingsGoalFormValues>(initialGoal)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadGoals = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [goalData, accountData] = await Promise.all([
        listSavingsGoals(user.id),
        listAccounts(user.id).catch(() => [] as Account[]),
      ])
      setGoals(goalData)
      setAccounts(accountData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las metas de ahorro.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadGoals()
  }, [loadGoals])

  useEffect(() => {
    window.addEventListener(savingsGoalsChangedEvent, loadGoals)
    window.addEventListener(accountsChangedEvent, loadGoals)
    return () => {
      window.removeEventListener(savingsGoalsChangedEvent, loadGoals)
      window.removeEventListener(accountsChangedEvent, loadGoals)
    }
  }, [loadGoals])

  const activeGoals = useMemo(() => goals.filter((goal) => goal.status !== 'cancelled'), [goals])
  const mainGoal = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.status !== 'completed')
        .sort((a, b) => savingsGoalProgress(b) - savingsGoalProgress(a))[0],
    [activeGoals],
  )
  const closestGoal = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.status !== 'completed' && goal.target_date)
        .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)))[0],
    [activeGoals],
  )
  const averageProgress = useMemo(() => {
    if (!activeGoals.length) return 0
    return activeGoals.reduce((total, goal) => total + savingsGoalProgress(goal), 0) / activeGoals.length
  }, [activeGoals])
  const totalSaved = useMemo(() => totalInActiveCurrency(activeGoals, 'current_amount'), [activeGoals])
  const totalTarget = useMemo(() => totalInActiveCurrency(activeGoals, 'target_amount'), [activeGoals])

  async function handleSubmit() {
    if (!user) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await saveSavingsGoal(user.id, values)
      setValues({ ...initialGoal, currency: getActiveCurrency() })
      setShowForm(false)
      setSuccess(values.id ? 'Meta actualizada correctamente.' : 'Meta creada correctamente.')
      await loadGoals()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la meta.')
    } finally {
      setSaving(false)
    }
  }

  function startCreate() {
    setValues({ ...initialGoal, currency: getActiveCurrency() })
    setShowForm(true)
    setSuccess('')
    setError('')
  }

  function startEdit(goal: SavingsGoal) {
    setValues(goalToForm(goal))
    setShowForm(true)
    setSuccess('')
    setError('')
  }

  async function changeStatus(goal: SavingsGoal, status: SavingsGoal['status']) {
    if (!user) return
    setError('')
    setSuccess('')
    try {
      await updateSavingsGoalStatus(user.id, goal.id, status)
      setSuccess('Estado de la meta actualizado.')
      await loadGoals()
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'No se pudo actualizar la meta.')
    }
  }

  async function removeGoal(goal: SavingsGoal) {
    if (!user) return
    const confirmed = await confirm({
      title: `Eliminar "${goal.name}"?`,
      description: 'La meta se eliminara de tu lista. Esto no afecta tus movimientos ni cuentas.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!confirmed) return

    setError('')
    setSuccess('')
    try {
      await deleteSavingsGoal(user.id, goal.id)
      setSuccess('Meta eliminada correctamente.')
      await loadGoals()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la meta.')
    }
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100">
            Metas de ahorro
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
            Planifica objetivos y avances
          </h2>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Crear meta
        </button>
      </div>

      {error ? <StatusMessage message={error} /> : null}
      {success ? <StatusMessage message={success} variant="success" /> : null}

      {loading ? (
        <>
          <SkeletonStats count={4} />
          <SkeletonList rows={3} itemHeight="h-64" />
        </>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Meta principal" value={mainGoal?.name ?? 'Sin meta'} icon={Target} />
            <StatCard title="Total ahorrado" value={formatCurrencyAmount(totalSaved)} icon={Wallet} />
            <StatCard title="Objetivo total" value={formatCurrencyAmount(totalTarget)} icon={TrendingUp} tone="gold" />
            <StatCard title="Progreso promedio" value={`${Math.round(averageProgress)}%`} icon={Target} />
          </section>

          {closestGoal ? (
            <section className="rounded-lg border border-line bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <p className="font-semibold text-ink dark:text-white">Meta mas cercana: {closestGoal.name}</p>
              <p className="mt-1 text-muted dark:text-slate-400">
                Fecha objetivo: {closestGoal.target_date}. Restante:{' '}
                {formatCurrencyAmount(Math.max(Number(closestGoal.target_amount) - Number(closestGoal.current_amount), 0), closestGoal.currency)}.
              </p>
            </section>
          ) : null}

          {showForm ? (
            <SavingsGoalForm
              values={values}
              accounts={accounts}
              saving={saving}
              onChange={setValues}
              onSubmit={() => void handleSubmit()}
              onCancel={() => {
                setShowForm(false)
                setValues({ ...initialGoal, currency: getActiveCurrency() })
              }}
            />
          ) : null}

          {goals.length ? (
            <section className="grid gap-4 xl:grid-cols-2">
              {goals.map((goal) => (
                <SavingsGoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={startEdit}
                  onPause={(item) => void changeStatus(item, 'paused')}
                  onResume={(item) => void changeStatus(item, 'active')}
                  onComplete={(item) => void changeStatus(item, 'completed')}
                  onDelete={(item) => void removeGoal(item)}
                />
              ))}
            </section>
          ) : (
            <EmptyState
              title="Aun no tienes metas de ahorro"
              detail="Crea tu primera meta para dar seguimiento a fondos de emergencia, viajes o compras importantes."
            />
          )}
        </>
      )}
    </div>
  )
}
