import { Edit2, History, Trash2 } from 'lucide-react'
import type { SavingsGoal, SavingsGoalContribution } from '../types/finance'
import { formatCurrencyAmount } from '../utils/currency'
import { formatDate } from '../utils/format'

function contributionModeLabel(contribution: SavingsGoalContribution) {
  return contribution.contribution_mode === 'transfer' ? 'Transferencia' : 'Manual'
}

export function SavingsGoalContributionsPanel({
  goal,
  contributions,
  onEdit,
  onDelete,
}: {
  goal: SavingsGoal
  contributions: SavingsGoalContribution[]
  onEdit: (contribution: SavingsGoalContribution) => void
  onDelete: (contribution: SavingsGoalContribution) => void
}) {
  const total = contributions.reduce((sum, contribution) => sum + Number(contribution.amount), 0)
  const latest = contributions[0]

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink dark:text-white">Historial de aportes</h3>
            <p className="text-sm text-muted dark:text-slate-400">{goal.name}</p>
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
          <span className="text-muted dark:text-slate-400">Total aportado</span>
          <p className="font-semibold text-brand-700 dark:text-brand-100">{formatCurrencyAmount(total, goal.currency)}</p>
        </div>
      </div>

      {latest ? (
        <p className="mt-3 text-sm text-muted dark:text-slate-400">
          Ultimo aporte: {formatCurrencyAmount(Number(latest.amount), goal.currency)} el {formatDate(latest.contribution_date)}.
        </p>
      ) : null}

      {contributions.length ? (
        <div className="mt-4 divide-y divide-line dark:divide-slate-800">
          {contributions.map((contribution) => (
            <div key={contribution.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-ink dark:text-white">
                  {formatCurrencyAmount(Number(contribution.amount), goal.currency)}
                </p>
                <p className="text-sm text-muted dark:text-slate-400">
                  {formatDate(contribution.contribution_date)}
                  {contribution.account ? ` - ${contribution.account.name}` : ''}
                </p>
                <p className="text-sm text-muted dark:text-slate-400">
                  {contributionModeLabel(contribution)}
                  {contribution.contribution_mode === 'transfer'
                    ? `: ${contribution.source_account?.name ?? 'Origen'} a ${contribution.destination_account?.name ?? 'Destino'}`
                    : ''}
                </p>
                {contribution.note ? (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{contribution.note}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(contribution)}
                  className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Edit2 className="h-4 w-4" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(contribution)}
                  className="inline-flex items-center gap-2 rounded-lg border border-coral-500/30 px-3 py-2 text-sm font-semibold text-coral-600 hover:bg-coral-50 dark:text-coral-400 dark:hover:bg-coral-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted dark:text-slate-400">Esta meta aun no tiene aportes registrados.</p>
      )}
    </section>
  )
}
