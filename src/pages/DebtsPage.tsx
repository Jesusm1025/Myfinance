import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CircleDollarSign, ClipboardList, Plus, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState } from '../components/EmptyState'
import { StatCard } from '../components/StatCard'
import { StatusMessage } from '../components/StatusMessage'
import { debtsChangedEvent } from '../events/financeEvents'
import { listDebts } from '../services/accounting'
import type { Debt } from '../types/finance'
import { debtFrequencyLabel, debtStatusLabel, debtTypeLabel, formatDate, formatMoney } from '../utils/format'

export function DebtsPage() {
  const { user } = useAuth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
            Organiza prestamos, tarjetas pendientes y compromisos por pagar desde una vista separada.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <Plus className="h-5 w-5" />
          Registrar deuda
        </button>
      </div>

      {error ? <StatusMessage message={error} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Saldo pendiente" value={formatMoney(summary.pending)} icon={CircleDollarSign} tone="coral" />
        <StatCard title="Deudas activas" value={String(summary.activeCount)} icon={ClipboardList} />
        <StatCard title="Pagos minimos" value={formatMoney(summary.minimumPayments)} icon={ShieldCheck} tone="gold" />
        <StatCard title="Deudas vencidas" value={String(summary.overdueCount)} icon={CalendarClock} tone="coral" />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <DebtIntroCard
          icon={CircleDollarSign}
          title="Saldo pendiente"
          detail="Aqui se resumira el total por pagar cuando agreguemos la logica de deudas."
        />
        <DebtIntroCard
          icon={ClipboardList}
          title="Pagos programados"
          detail="La pantalla queda lista para mostrar cuotas, fechas y prioridades."
        />
        <DebtIntroCard
          icon={ShieldCheck}
          title="Seguimiento"
          detail="Podras revisar avances sin mezclar esta seccion con el dashboard principal."
        />
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Aun no tienes deudas registradas"
            detail="La tabla y los servicios ya estan preparados. El siguiente paso puede ser activar el formulario para guardar deudas."
          />
        )}
      </section>
    </div>
  )
}

function DebtIntroCard({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof CircleDollarSign
  title: string
  detail: string
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted dark:text-slate-400">{detail}</p>
    </article>
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
