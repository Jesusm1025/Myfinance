import type { Account, SavingsGoal, SavingsGoalContributionFormValues } from '../types/finance'
import { formatCurrencyAmount } from '../utils/currency'
import { savingsGoalRemaining } from './SavingsGoalCard'

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20'
const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'

export function SavingsGoalContributionForm({
  goal,
  values,
  accounts,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  goal: SavingsGoal
  values: SavingsGoalContributionFormValues
  accounts: Account[]
  saving: boolean
  onChange: (values: SavingsGoalContributionFormValues) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const amount = Number(values.amount)
  const remaining = savingsGoalRemaining(goal)
  const exceedsGoal = Number.isFinite(amount) && amount > remaining && remaining > 0

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div>
        <h3 className="text-lg font-semibold text-ink dark:text-white">
          {values.id ? 'Editar aporte' : `Aportar a ${goal.name}`}
        </h3>
        <p className="text-sm text-muted dark:text-slate-400">Puedes registrarlo solo en la meta o mover dinero entre cuentas.</p>
      </div>

      {exceedsGoal ? (
        <div className="mt-4 rounded-lg border border-gold-500/30 bg-gold-50 px-3 py-2 text-sm text-gold-700 dark:border-gold-500/30 dark:bg-gold-500/10 dark:text-gold-300">
          El aporte supera el monto restante ({formatCurrencyAmount(remaining, goal.currency)}). La meta quedara completada.
        </div>
      ) : null}

      <form
        className="mt-5 grid gap-4 lg:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <fieldset className="lg:col-span-2">
          <legend className={labelClass}>Como quieres registrar este aporte?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[
              {
                value: 'manual',
                title: 'Solo en la meta',
                detail: 'Actualiza el progreso sin tocar cuentas.',
              },
              {
                value: 'transfer',
                title: 'Como transferencia entre cuentas',
                detail: 'Mueve dinero entre cuentas y no cuenta como gasto.',
              },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...values,
                    contribution_mode: option.value as SavingsGoalContributionFormValues['contribution_mode'],
                    destination_account_id:
                      option.value === 'transfer'
                        ? values.destination_account_id || goal.account_id || ''
                        : values.destination_account_id,
                    account_id: option.value === 'transfer' ? goal.account_id ?? values.destination_account_id : values.account_id,
                  })
                }
                className={`rounded-lg border px-3 py-3 text-left text-sm ${
                  values.contribution_mode === option.value
                    ? 'border-brand-500/40 bg-brand-50 text-brand-800 dark:border-brand-400/30 dark:bg-brand-500/15 dark:text-brand-100'
                    : 'border-line text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-950'
                }`}
              >
                <span className="font-semibold">{option.title}</span>
                <span className="mt-1 block text-xs opacity-80">{option.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className={labelClass}>Monto aportado</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.amount}
            onChange={(event) => onChange({ ...values, amount: event.target.value })}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Fecha del aporte</span>
          <input
            type="date"
            value={values.contribution_date}
            onChange={(event) => onChange({ ...values, contribution_date: event.target.value })}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        {values.contribution_mode === 'transfer' ? (
          <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Cuenta origen</span>
              <select
                value={values.source_account_id}
                onChange={(event) => onChange({ ...values, source_account_id: event.target.value })}
                className={`mt-1 ${fieldClass}`}
              >
                <option value="">Selecciona origen</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Cuenta destino</span>
              <select
                value={values.destination_account_id}
                onChange={(event) =>
                  onChange({
                    ...values,
                    destination_account_id: event.target.value,
                    account_id: event.target.value,
                  })
                }
                className={`mt-1 ${fieldClass}`}
              >
                <option value="">Selecciona destino</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-brand-500/20 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-400/20 dark:bg-brand-500/10 dark:text-brand-100 lg:col-span-2">
              Esta transferencia cambiara balances de cuentas, pero no aumentara ingresos ni gastos.
            </div>
          </div>
        ) : (
          <label className="block lg:col-span-2">
            <span className={labelClass}>Cuenta opcional</span>
            <select
              value={values.account_id}
              onChange={(event) => onChange({ ...values, account_id: event.target.value })}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="">Sin cuenta asociada</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block lg:col-span-2">
          <span className={labelClass}>Nota opcional</span>
          <textarea
            value={values.note}
            onChange={(event) => onChange({ ...values, note: event.target.value })}
            className={`mt-1 min-h-20 ${fieldClass}`}
            placeholder="Ej. Aporte de quincena"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2 lg:col-span-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : values.id ? 'Guardar aporte' : 'Registrar aporte'}
          </button>
        </div>
      </form>
    </section>
  )
}
