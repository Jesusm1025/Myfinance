import { CheckCircle2, Edit2, PauseCircle, PlayCircle, Target, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import type { SavingsGoal } from '../types/finance'
import { formatCurrencyAmount } from '../utils/currency'
import { formatDate } from '../utils/format'

export function savingsGoalTypeLabel(type: SavingsGoal['goal_type']) {
  const labels = {
    emergency_fund: 'Fondo de emergencia',
    vehicle_down_payment: 'Inicial de vehiculo',
    travel: 'Viaje',
    purchase: 'Compra importante',
    monthly_savings: 'Ahorro mensual',
    custom: 'Personalizada',
  }
  return labels[type]
}

export function savingsGoalStatusLabel(status: SavingsGoal['status']) {
  const labels = {
    active: 'Activa',
    completed: 'Completada',
    paused: 'Pausada',
    cancelled: 'Cancelada',
  }
  return labels[status]
}

export function savingsGoalProgress(goal: SavingsGoal) {
  return Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100)
}

export function savingsGoalRemaining(goal: SavingsGoal) {
  return Math.max(Number(goal.target_amount) - Number(goal.current_amount), 0)
}

export function suggestedMonthlySaving(goal: SavingsGoal) {
  if (goal.monthly_target !== null && Number(goal.monthly_target) > 0) return Number(goal.monthly_target)
  if (!goal.target_date) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [year, month, day] = goal.target_date.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  target.setHours(0, 0, 0, 0)
  const monthDiff = Math.max(
    (target.getFullYear() - today.getFullYear()) * 12 + target.getMonth() - today.getMonth() + 1,
    1,
  )
  return savingsGoalRemaining(goal) / monthDiff
}

export function savingsGoalHealth(goal: SavingsGoal): 'healthy' | 'late' | 'completed' {
  if (goal.status === 'completed' || savingsGoalProgress(goal) >= 100) return 'completed'
  if (!goal.target_date || goal.status !== 'active') return 'healthy'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [year, month, day] = goal.target_date.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  target.setHours(0, 0, 0, 0)
  if (target < today && savingsGoalRemaining(goal) > 0) return 'late'

  const created = new Date(goal.created_at)
  const totalDays = Math.max((target.getTime() - created.getTime()) / 86_400_000, 1)
  const elapsedDays = Math.max((today.getTime() - created.getTime()) / 86_400_000, 0)
  const expectedProgress = Math.min((elapsedDays / totalDays) * 100, 100)
  return savingsGoalProgress(goal) + 10 < expectedProgress ? 'late' : 'healthy'
}

export function SavingsGoalCard({
  goal,
  onEdit,
  onPause,
  onResume,
  onComplete,
  onDelete,
}: {
  goal: SavingsGoal
  onEdit: (goal: SavingsGoal) => void
  onPause: (goal: SavingsGoal) => void
  onResume: (goal: SavingsGoal) => void
  onComplete: (goal: SavingsGoal) => void
  onDelete: (goal: SavingsGoal) => void
}) {
  const progress = savingsGoalProgress(goal)
  const remaining = savingsGoalRemaining(goal)
  const monthlySaving = suggestedMonthlySaving(goal)
  const health = savingsGoalHealth(goal)
  const healthLabel = {
    healthy: 'Saludable',
    late: 'Atrasada',
    completed: 'Completada',
  }[health]

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: goal.color }}>
            <Target className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-ink dark:text-white">{goal.name}</p>
            <p className="text-sm text-muted dark:text-slate-400">{savingsGoalTypeLabel(goal.goal_type)}</p>
            {goal.account ? (
              <p className="mt-1 text-xs text-muted dark:text-slate-400">Cuenta: {goal.account.name}</p>
            ) : null}
          </div>
        </div>
        <span
          className={clsx(
            'shrink-0 rounded-full px-2 py-1 text-xs font-semibold',
            health === 'completed' && 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100',
            health === 'late' && 'bg-coral-50 text-coral-700 dark:bg-coral-500/15 dark:text-coral-300',
            health === 'healthy' && 'bg-gold-50 text-gold-700 dark:bg-gold-500/15 dark:text-gold-300',
          )}
        >
          {healthLabel}
        </span>
      </div>

      {goal.description ? <p className="mt-3 text-sm leading-6 text-muted dark:text-slate-400">{goal.description}</p> : null}

      <div className="mt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted dark:text-slate-400">Progreso</p>
            <p className="text-xl font-semibold text-ink dark:text-white">
              {formatCurrencyAmount(Number(goal.current_amount), goal.currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted dark:text-slate-400">Objetivo</p>
            <p className="font-semibold text-ink dark:text-white">
              {formatCurrencyAmount(Number(goal.target_amount), goal.currency)}
            </p>
          </div>
        </div>
        <div className="mt-3 h-3 rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={clsx('h-3 rounded-full', health === 'late' ? 'bg-coral-500' : health === 'completed' ? 'bg-brand-600' : 'bg-gold-500')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{Math.round(progress)}% completado</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Metric label="Restante" value={formatCurrencyAmount(remaining, goal.currency)} tone={remaining > 0 ? 'expense' : 'income'} />
        <Metric label="Sugerido mensual" value={monthlySaving ? formatCurrencyAmount(monthlySaving, goal.currency) : 'Sin fecha'} />
        <Metric label="Estado" value={savingsGoalStatusLabel(goal.status)} />
        <Metric label="Fecha objetivo" value={goal.target_date ? formatDate(goal.target_date) : 'Sin fecha'} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton label="Editar" icon={Edit2} onClick={() => onEdit(goal)} />
        {goal.status === 'paused' ? (
          <ActionButton label="Reanudar" icon={PlayCircle} onClick={() => onResume(goal)} />
        ) : (
          <ActionButton label="Pausar" icon={PauseCircle} onClick={() => onPause(goal)} disabled={goal.status === 'completed'} />
        )}
        <ActionButton label="Completar" icon={CheckCircle2} onClick={() => onComplete(goal)} disabled={goal.status === 'completed'} />
        <ActionButton label="Eliminar" icon={Trash2} onClick={() => onDelete(goal)} danger />
      </div>
    </article>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'expense' }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
      <p className="text-xs text-muted dark:text-slate-400">{label}</p>
      <p
        className={clsx(
          'mt-1 truncate font-semibold',
          tone === 'income' && 'text-brand-700 dark:text-brand-100',
          tone === 'expense' && 'text-coral-600 dark:text-coral-400',
          !tone && 'text-ink dark:text-white',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  danger = false,
  disabled = false,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50',
        danger
          ? 'border-coral-500/30 text-coral-600 hover:bg-coral-50 dark:text-coral-400 dark:hover:bg-coral-500/10'
          : 'border-line text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}
