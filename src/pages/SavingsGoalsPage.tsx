import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Target, TrendingUp, Wallet } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState } from '../components/EmptyState'
import { SavingsGoalCard, savingsGoalProgress } from '../components/SavingsGoalCard'
import { SavingsGoalContributionForm } from '../components/SavingsGoalContributionForm'
import { SavingsGoalContributionsPanel } from '../components/SavingsGoalContributionsPanel'
import { SavingsGoalForm } from '../components/SavingsGoalForm'
import { SkeletonList, SkeletonStats } from '../components/Skeleton'
import { StatCard } from '../components/StatCard'
import { StatusMessage } from '../components/StatusMessage'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { accountsChangedEvent, savingsGoalsChangedEvent } from '../events/financeEvents'
import {
  deleteSavingsGoal,
  deleteSavingsGoalContribution,
  listAccounts,
  listSavingsGoalContributions,
  listSavingsGoals,
  saveSavingsGoal,
  saveSavingsGoalContribution,
  updateSavingsGoalStatus,
} from '../services/accounting'
import type { Account, SavingsGoal, SavingsGoalContribution, SavingsGoalContributionFormValues, SavingsGoalFormValues } from '../types/finance'
import { formatCurrencyAmount, getActiveCurrency } from '../utils/currency'
import { scrollToElement } from '../utils/scroll'

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

function initialContribution(goalId = ''): SavingsGoalContributionFormValues {
  return {
    goal_id: goalId,
    account_id: '',
    source_account_id: '',
    destination_account_id: '',
    contribution_mode: 'manual',
    amount: '',
    contribution_date: new Date().toISOString().slice(0, 10),
    note: '',
  }
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
  const [contributions, setContributions] = useState<SavingsGoalContribution[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [values, setValues] = useState<SavingsGoalFormValues>(initialGoal)
  const [contributionValues, setContributionValues] = useState<SavingsGoalContributionFormValues>(initialContribution())
  const [selectedContributionGoalId, setSelectedContributionGoalId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showContributionForm, setShowContributionForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const goalFormRef = useRef<HTMLDivElement | null>(null)
  const contributionFormRef = useRef<HTMLDivElement | null>(null)

  const loadGoals = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [goalData, contributionData, accountData] = await Promise.all([
        listSavingsGoals(user.id),
        listSavingsGoalContributions(user.id),
        listAccounts(user.id).catch(() => [] as Account[]),
      ])
      setGoals(goalData)
      setContributions(contributionData)
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
  const contributionsByGoal = useMemo(() => {
    const rows = new Map<string, SavingsGoalContribution[]>()
    contributions.forEach((contribution) => {
      const current = rows.get(contribution.goal_id) ?? []
      current.push(contribution)
      rows.set(contribution.goal_id, current)
    })
    return rows
  }, [contributions])
  const selectedContributionGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedContributionGoalId) ?? null,
    [goals, selectedContributionGoalId],
  )
  const editingGoalHasContributions = useMemo(
    () => Boolean(values.id && (contributionsByGoal.get(values.id)?.length ?? 0) > 0),
    [contributionsByGoal, values.id],
  )

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

  async function handleContributionSubmit() {
    if (!user || !selectedContributionGoal) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await saveSavingsGoalContribution(user.id, contributionValues)
      setContributionValues(initialContribution())
      setSelectedContributionGoalId('')
      setShowContributionForm(false)
      setSuccess(contributionValues.id ? 'Aporte actualizado correctamente.' : 'Aporte registrado correctamente.')
      await loadGoals()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el aporte.')
    } finally {
      setSaving(false)
    }
  }

  function startCreate() {
    setValues({ ...initialGoal, currency: getActiveCurrency() })
    setShowForm(true)
    setSuccess('')
    setError('')
    scrollToElement(goalFormRef)
  }

  function startEdit(goal: SavingsGoal) {
    setValues(goalToForm(goal))
    setShowForm(true)
    setSuccess('')
    setError('')
    scrollToElement(goalFormRef)
  }

  function startContribution(goal: SavingsGoal) {
    setSelectedContributionGoalId(goal.id)
    setContributionValues({
      ...initialContribution(goal.id),
      account_id: goal.account_id ?? '',
      destination_account_id: goal.account_id ?? '',
    })
    setShowContributionForm(true)
    setShowForm(false)
    setSuccess('')
    setError('')
    scrollToElement(contributionFormRef)
  }

  function editContribution(contribution: SavingsGoalContribution) {
    setSelectedContributionGoalId(contribution.goal_id)
    setContributionValues({
      id: contribution.id,
      goal_id: contribution.goal_id,
      account_id: contribution.account_id ?? '',
      source_account_id: contribution.source_account_id ?? '',
      destination_account_id: contribution.destination_account_id ?? '',
      contribution_mode: contribution.contribution_mode ?? 'manual',
      amount: String(contribution.amount),
      contribution_date: contribution.contribution_date,
      note: contribution.note ?? '',
    })
    setShowContributionForm(true)
    setShowForm(false)
    setSuccess('')
    setError('')
    scrollToElement(contributionFormRef)
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
    const goalContributions = contributionsByGoal.get(goal.id) ?? []
    const transferCount = goalContributions.filter((contribution) => contribution.transfer_id).length
    const confirmed = await confirm({
      title: `Eliminar "${goal.name}"?`,
      description: transferCount
        ? `Esta meta tiene ${transferCount} aporte(s) con transferencia asociada. La meta y su historial de aportes se eliminaran, pero las transferencias historicas permaneceran en Cuentas y seguiran afectando balances.`
        : goalContributions.length
          ? 'La meta y su historial de aportes se eliminaran. Esto no afecta movimientos ni cuentas.'
          : 'La meta se eliminara de tu lista. Esto no afecta tus movimientos ni cuentas.',
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

  async function removeContribution(contribution: SavingsGoalContribution) {
    if (!user) return
    let deleteTransfer = false
    if (contribution.transfer_id) {
      deleteTransfer = await confirm({
        title: 'Eliminar aporte y transferencia?',
        description: 'Este aporte tiene una transferencia asociada. Si confirmas, tambien se eliminara la transferencia y se revertira el cambio entre cuentas.',
        confirmLabel: 'Eliminar ambos',
        cancelLabel: 'No, revisar',
        variant: 'danger',
      })

      if (!deleteTransfer) {
        const deleteOnlyContribution = await confirm({
          title: 'Eliminar solo el aporte?',
          description: 'La transferencia quedara registrada en cuentas, pero el aporte dejara de contar para la meta.',
          confirmLabel: 'Eliminar solo aporte',
          variant: 'danger',
        })
        if (!deleteOnlyContribution) return
      }
    } else {
      const confirmed = await confirm({
        title: 'Eliminar aporte?',
        description: 'El progreso de la meta se recalculara automaticamente al eliminar este aporte.',
        confirmLabel: 'Eliminar',
        variant: 'danger',
      })
      if (!confirmed) return
    }

    setError('')
    setSuccess('')
    try {
      await deleteSavingsGoalContribution(user.id, contribution.id, deleteTransfer)
      setSuccess('Aporte eliminado correctamente.')
      await loadGoals()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el aporte.')
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
            <div ref={goalFormRef} className="scroll-mt-24">
              <SavingsGoalForm
                values={values}
                accounts={accounts}
                saving={saving}
                currentAmountReadOnly={editingGoalHasContributions}
                onChange={setValues}
                onSubmit={() => void handleSubmit()}
                onCancel={() => {
                  setShowForm(false)
                  setValues({ ...initialGoal, currency: getActiveCurrency() })
                }}
              />
            </div>
          ) : null}

          {showContributionForm && selectedContributionGoal ? (
            <div ref={contributionFormRef} className="scroll-mt-24">
              <SavingsGoalContributionForm
                goal={selectedContributionGoal}
                values={contributionValues}
                accounts={accounts}
                saving={saving}
                onChange={setContributionValues}
                onSubmit={() => void handleContributionSubmit()}
                onCancel={() => {
                  setShowContributionForm(false)
                  setSelectedContributionGoalId('')
                  setContributionValues(initialContribution())
                }}
              />
            </div>
          ) : null}

          {goals.length ? (
            <section className="grid gap-4 xl:grid-cols-2">
              {goals.map((goal) => (
                <div key={goal.id} className="space-y-4">
                  <SavingsGoalCard
                    goal={goal}
                    contributions={contributionsByGoal.get(goal.id) ?? []}
                    onEdit={startEdit}
                    onContribute={startContribution}
                    onPause={(item) => void changeStatus(item, 'paused')}
                    onResume={(item) => void changeStatus(item, 'active')}
                    onComplete={(item) => void changeStatus(item, 'completed')}
                    onDelete={(item) => void removeGoal(item)}
                  />
                  <SavingsGoalContributionsPanel
                    goal={goal}
                    contributions={contributionsByGoal.get(goal.id) ?? []}
                    onEdit={editContribution}
                    onDelete={(item) => void removeContribution(item)}
                  />
                </div>
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
