import type { Account, DebtCurrencyCode, SavingsGoalFormValues, SavingsGoalStatus, SavingsGoalType } from '../types/finance'
import { currencyOptions } from '../utils/currency'
import { savingsGoalStatusLabel, savingsGoalTypeLabel } from './SavingsGoalCard'

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20'
const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'

const goalTypes: SavingsGoalType[] = ['emergency_fund', 'vehicle_down_payment', 'travel', 'purchase', 'monthly_savings', 'custom']
const statuses: SavingsGoalStatus[] = ['active', 'paused', 'completed', 'cancelled']
const colors = ['#198c7c', '#0f766e', '#2563eb', '#7c3aed', '#d97706', '#ee6c4d', '#475569']

export function SavingsGoalForm({
  values,
  accounts,
  saving,
  currentAmountReadOnly = false,
  onChange,
  onSubmit,
  onCancel,
}: {
  values: SavingsGoalFormValues
  accounts: Account[]
  saving: boolean
  currentAmountReadOnly?: boolean
  onChange: (values: SavingsGoalFormValues) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div>
        <h3 className="text-lg font-semibold text-ink dark:text-white">{values.id ? 'Editar meta' : 'Crear meta de ahorro'}</h3>
        <p className="text-sm text-muted dark:text-slate-400">Define un objetivo simple y actualiza el progreso manualmente.</p>
      </div>

      <form
        className="mt-5 grid gap-4 lg:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <label className="block">
          <span className={labelClass}>Nombre</span>
          <input
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            className={`mt-1 ${fieldClass}`}
            placeholder="Fondo de emergencia"
          />
        </label>

        <label className="block">
          <span className={labelClass}>Tipo de meta</span>
          <select
            value={values.goal_type}
            onChange={(event) => onChange({ ...values, goal_type: event.target.value as SavingsGoalType })}
            className={`mt-1 ${fieldClass}`}
          >
            {goalTypes.map((type) => (
              <option key={type} value={type}>
                {savingsGoalTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Monto objetivo</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.target_amount}
            onChange={(event) => onChange({ ...values, target_amount: event.target.value })}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Monto actual</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.current_amount}
            readOnly={currentAmountReadOnly}
            onChange={(event) => onChange({ ...values, current_amount: event.target.value })}
            className={`mt-1 ${fieldClass} ${currentAmountReadOnly ? 'cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : ''}`}
          />
          {currentAmountReadOnly ? (
            <span className="mt-1 block text-xs text-muted dark:text-slate-400">
              El monto actual se recalcula automaticamente desde los aportes.
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className={labelClass}>Moneda</span>
          <select
            value={values.currency}
            onChange={(event) => onChange({ ...values, currency: event.target.value as DebtCurrencyCode })}
            className={`mt-1 ${fieldClass}`}
          >
            {currencyOptions.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.prefix} - {currency.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Cuenta asociada opcional</span>
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

        <label className="block">
          <span className={labelClass}>Fecha objetivo</span>
          <input
            type="date"
            value={values.target_date}
            onChange={(event) => onChange({ ...values, target_date: event.target.value })}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Meta mensual opcional</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.monthly_target}
            onChange={(event) => onChange({ ...values, monthly_target: event.target.value })}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Estado</span>
          <select
            value={values.status}
            onChange={(event) => onChange({ ...values, status: event.target.value as SavingsGoalStatus })}
            className={`mt-1 ${fieldClass}`}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {savingsGoalStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Icono opcional</span>
          <input
            value={values.icon}
            onChange={(event) => onChange({ ...values, icon: event.target.value })}
            className={`mt-1 ${fieldClass}`}
            placeholder="target"
          />
        </label>

        <div className="lg:col-span-2">
          <span className={labelClass}>Color</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onChange({ ...values, color })}
                className="h-10 w-10 rounded-lg border-2"
                style={{
                  backgroundColor: color,
                  borderColor: values.color === color ? '#0f172a' : 'transparent',
                }}
                aria-label={`Usar color ${color}`}
              />
            ))}
          </div>
        </div>

        <label className="block lg:col-span-2">
          <span className={labelClass}>Descripcion</span>
          <textarea
            value={values.description}
            onChange={(event) => onChange({ ...values, description: event.target.value })}
            className={`mt-1 min-h-24 ${fieldClass}`}
            placeholder="Notas breves sobre esta meta"
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
            {saving ? 'Guardando...' : values.id ? 'Guardar cambios' : 'Crear meta'}
          </button>
        </div>
      </form>
    </section>
  )
}
