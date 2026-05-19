import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarClock, CircleDollarSign, ClipboardList, LoaderCircle, Plus, Save, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState } from '../components/EmptyState'
import { StatCard } from '../components/StatCard'
import { StatusMessage } from '../components/StatusMessage'
import { debtsChangedEvent } from '../events/financeEvents'
import { listDebts, saveDebt } from '../services/accounting'
import type { Debt, DebtFormValues } from '../types/finance'
import { debtFrequencyLabel, debtStatusLabel, debtTypeLabel, formatDate, formatMoney } from '../utils/format'

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20'

const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'

const initialDebt: DebtFormValues = {
  name: '',
  type: 'loan',
  creditor: '',
  initial_amount: '',
  outstanding_balance: '',
  start_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  interest_rate: '',
  minimum_payment: '',
  payment_frequency: 'monthly',
  status: 'active',
  notes: '',
}

export function DebtsPage() {
  const { user } = useAuth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [values, setValues] = useState<DebtFormValues>(initialDebt)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadDebts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      setDebts(await listDebts(user.id))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'No se pudieron cargar las deudas.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadDebts()
  }, [loadDebts])

  useEffect(() => {
    window.addEventListener(debtsChangedEvent, loadDebts)
    return () => window.removeEventListener(debtsChangedEvent, loadDebts)
  }, [loadDebts])

  const summary = useMemo(() => {
    const activeDebts = debts.filter((debt) => debt.status !== 'paid')
    const pending = activeDebts.reduce((total, debt) => total + Number(debt.outstanding_balance), 0)
    const minimumPayments = activeDebts.reduce((total, debt) => total + Number(debt.minimum_payment ?? 0), 0)
    const overdueCount = debts.filter((debt) => debt.status === 'overdue').length

    return {
      activeCount: activeDebts.length,
      pending,
      minimumPayments,
      overdueCount,
    }
  }, [debts])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const initialAmount = Number(values.initial_amount)
      const outstandingBalance = Number(values.outstanding_balance)

      if (!values.name.trim()) {
        throw new Error('El nombre de la deuda es obligatorio.')
      }
      if (!values.type) {
        throw new Error('El tipo de deuda es obligatorio.')
      }
      if (!values.start_date) {
        throw new Error('La fecha de inicio es obligatoria.')
      }
      if (!Number.isFinite(initialAmount) || initialAmount < 0) {
        throw new Error('El monto inicial debe ser mayor o igual a 0.')
      }
      if (!Number.isFinite(outstandingBalance) || outstandingBalance < 0) {
        throw new Error('El saldo pendiente debe ser mayor o igual a 0.')
      }
      if (outstandingBalance > initialAmount) {
        throw new Error('El saldo pendiente no puede ser mayor que el monto inicial.')
      }

      await saveDebt(user.id, values)
      setSuccess('Deuda registrada correctamente.')
      setValues(initialDebt)
      setShowForm(false)
      await loadDebts()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la deuda.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100">
            Deudas
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
            Manejo de deudas personales
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted dark:text-slate-400">
            Registra prestamos, tarjetas pendientes y compromisos por pagar asociados a tu cuenta.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          {showForm ? 'Cerrar formulario' : 'Registrar deuda'}
        </button>
      </div>

      {error ? <StatusMessage message={error} /> : null}
      {success ? <StatusMessage message={success} variant="success" /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Saldo pendiente" value={formatMoney(summary.pending)} icon={CircleDollarSign} tone="coral" />
        <StatCard title="Deudas activas" value={String(summary.activeCount)} icon={ClipboardList} />
        <StatCard title="Pagos minimos" value={formatMoney(summary.minimumPayments)} icon={ShieldCheck} tone="gold" />
        <StatCard title="Deudas vencidas" value={String(summary.overdueCount)} icon={CalendarClock} tone="coral" />
      </section>

      {showForm ? (
        <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Nueva deuda</h3>
              <p className="text-sm text-muted dark:text-slate-400">
                Guarda el compromiso con sus fechas y condiciones principales.
              </p>
            </div>
          </div>

          <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block">
              <span className={labelClass}>Nombre de la deuda</span>
              <input
                type="text"
                required
                value={values.name}
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                className={`mt-1 ${fieldClass}`}
                placeholder="Ej. Prestamo personal"
              />
            </label>

            <label className="block">
              <span className={labelClass}>Tipo de deuda</span>
              <select
                required
                value={values.type}
                onChange={(event) =>
                  setValues((current) => ({ ...current, type: event.target.value as DebtFormValues['type'] }))
                }
                className={`mt-1 ${fieldClass}`}
              >
                <option value="loan">Prestamo</option>
                <option value="credit_card">Tarjeta de credito</option>
                <option value="family">Familiar</option>
                <option value="store">Tienda</option>
                <option value="other">Otro</option>
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Acreedor</span>
              <input
                type="text"
                required
                value={values.creditor}
                onChange={(event) => setValues((current) => ({ ...current, creditor: event.target.value }))}
                className={`mt-1 ${fieldClass}`}
                placeholder="Banco, tienda o persona"
              />
            </label>

            <label className="block">
              <span className={labelClass}>Frecuencia de pago</span>
              <select
                value={values.payment_frequency}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    payment_frequency: event.target.value as DebtFormValues['payment_frequency'],
                  }))
                }
                className={`mt-1 ${fieldClass}`}
              >
                <option value="once">Unica</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Monto inicial</span>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={values.initial_amount}
                onChange={(event) => setValues((current) => ({ ...current, initial_amount: event.target.value }))}
                className={`mt-1 ${fieldClass}`}
                placeholder="0.00"
              />
            </label>

            <label className="block">
              <span className={labelClass}>Saldo pendiente</span>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={values.outstanding_balance}
                onChange={(event) => setValues((current) => ({ ...current, outstanding_balance: event.target.value }))}
                className={`mt-1 ${fieldClass}`}
                placeholder="0.00"
              />
            </label>

            <label className="block">
              <span className={labelClass}>Fecha de inicio</span>
              <input
                type="date"
                required
                value={values.start_date}
                onChange={(event) => setValues((current) => ({ ...current, start_date: event.target.value }))}
                className={`mt-1 ${fieldClass}`}
              />
            </label>

            <label className="block">
              <span className={labelClass}>Fecha de vencimiento</span>
              <input
                type="date"
                value={values.due_date}
                onChange={(event) => setValues((current) => ({ ...current, due_date: event.target.value }))}
                className={`mt-1 ${fieldClass}`}
              />
            </label>

            <label className="block">
              <span className={labelClass}>Tasa de interes opcional</span>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={values.interest_rate}
                onChange={(event) => setValues((current) => ({ ...current, interest_rate: event.target.value }))}
                className={`mt-1 ${fieldClass}`}
                placeholder="Ej. 18"
              />
            </label>

            <label className="block">
              <span className={labelClass}>Pago minimo opcional</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.minimum_payment}
                onChange={(event) => setValues((current) => ({ ...current, minimum_payment: event.target.value }))}
                className={`mt-1 ${fieldClass}`}
                placeholder="0.00"
              />
            </label>

            <label className="block lg:col-span-2">
              <span className={labelClass}>Notas</span>
              <textarea
                value={values.notes}
                onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
                className={`mt-1 min-h-24 resize-y ${fieldClass}`}
                placeholder="Detalle opcional sobre condiciones, cuotas o acuerdos"
              />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                Guardar deuda
              </button>
              <button
                type="button"
                onClick={() => {
                  setValues(initialDebt)
                  setShowForm(false)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-3 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Deudas registradas</h3>
            <p className="text-sm text-muted dark:text-slate-400">
              Cada registro se guarda con tu usuario autenticado en Supabase.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted dark:text-slate-400">Cargando deudas...</p>
        ) : debts.length ? (
          <div className="space-y-3">
            {debts.map((debt) => (
              <article
                key={debt.id}
                className="rounded-lg border border-line p-4 dark:border-slate-800"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-ink dark:text-white">{debt.name}</p>
                    <p className="mt-1 text-sm text-muted dark:text-slate-400">
                      {debtTypeLabel(debt.type)} con {debt.creditor}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
                    {debtStatusLabel(debt.status)}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                  <DebtMetric label="Saldo pendiente" value={formatMoney(Number(debt.outstanding_balance))} />
                  <DebtMetric label="Monto inicial" value={formatMoney(Number(debt.initial_amount))} />
                  <DebtMetric label="Frecuencia" value={debtFrequencyLabel(debt.payment_frequency)} />
                  <DebtMetric label="Vencimiento" value={debt.due_date ? formatDate(debt.due_date) : 'Sin fecha'} />
                </dl>

                {debt.notes ? (
                  <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-muted dark:bg-slate-950 dark:text-slate-400">
                    {debt.notes}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Aun no tienes deudas registradas"
            detail="Usa Registrar deuda para guardar tu primer prestamo, tarjeta o compromiso pendiente."
          />
        )}
      </section>
    </div>
  )
}

function DebtMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted dark:text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold text-ink dark:text-white">{value}</dd>
    </div>
  )
}
