import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDollarSign, ClipboardList, CreditCard, Edit2, GraduationCap, History, LoaderCircle, Plus, Save, ShieldCheck, TrendingUp, Trash2, WalletCards, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState } from '../components/EmptyState'
import { StatCard } from '../components/StatCard'
import { StatusMessage } from '../components/StatusMessage'
import { debtsChangedEvent } from '../events/financeEvents'
import { createEducationDebtSeed, deleteDebt, listAccounts, listDebtInstallments, listDebtPayments, listDebts, listDebtSubaccounts, payDebtInstallment, registerDebtPayment, saveDebt } from '../services/accounting'
import type { Account, Debt, DebtFormValues, DebtInstallment, DebtPayment, DebtPaymentFormValues, DebtStatus, DebtSubaccount, DebtSubaccountFormValues } from '../types/finance'
import {
  creditCardDebtStatusLabel,
  debtFrequencyLabel,
  debtInstallmentStatusLabel,
  debtStatusLabel,
  debtTypeLabel,
  formatDate,
  formatMoney,
  paymentMethodLabel,
} from '../utils/format'

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20'

const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'

const defaultCardSubaccounts: DebtSubaccountFormValues[] = [
  { name: 'Credimas', balance: '', credit_limit: '' },
  { name: 'Avances', balance: '', credit_limit: '' },
  { name: 'Cuotas', balance: '', credit_limit: '' },
  { name: 'Financiamientos', balance: '', credit_limit: '' },
]

const initialDebt: DebtFormValues = {
  name: '',
  type: 'loan',
  creditor: '',
  currency: 'DOP',
  initial_amount: '',
  outstanding_balance: '',
  start_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  interest_rate: '',
  minimum_payment: '',
  card_last4: '',
  credit_limit: '',
  used_balance: '',
  statement_balance: '',
  balance_dop: '',
  balance_usd: '',
  minimum_payment_dop: '',
  minimum_payment_usd: '',
  credit_limit_dop: '',
  credit_limit_usd: '',
  usd_to_dop_rate: '',
  statement_date: '',
  credit_card_status: '',
  subaccounts: defaultCardSubaccounts,
  payment_frequency: 'monthly',
  status: 'active',
  notes: '',
}

function initialDebtPayment(debtId = ''): DebtPaymentFormValues {
  return {
    debt_id: debtId,
    amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: '',
    create_movement: false,
    account_id: '',
    note: '',
  }
}

type DebtStatusFilter = 'all' | DebtStatus
type DebtSort = 'due_date' | 'outstanding_balance'
const dueSoonDays = 7

export function DebtsPage() {
  const { user } = useAuth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [payments, setPayments] = useState<DebtPayment[]>([])
  const [subaccounts, setSubaccounts] = useState<DebtSubaccount[]>([])
  const [installments, setInstallments] = useState<DebtInstallment[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [values, setValues] = useState<DebtFormValues>(initialDebt)
  const [paymentValues, setPaymentValues] = useState<Record<string, DebtPaymentFormValues>>({})
  const [openPaymentDebtId, setOpenPaymentDebtId] = useState('')
  const [statusFilter, setStatusFilter] = useState<DebtStatusFilter>('all')
  const [sortBy, setSortBy] = useState<DebtSort>('due_date')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submittingPaymentId, setSubmittingPaymentId] = useState('')
  const [submittingEducationSeed, setSubmittingEducationSeed] = useState(false)
  const [payingInstallmentId, setPayingInstallmentId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadDebts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [debtData, paymentData, subaccountData, installmentData, accountData] = await Promise.all([
        listDebts(user.id),
        listDebtPayments(user.id).catch(() => [] as DebtPayment[]),
        listDebtSubaccounts(user.id).catch(() => [] as DebtSubaccount[]),
        listDebtInstallments(user.id).catch(() => [] as DebtInstallment[]),
        listAccounts(user.id).catch(() => [] as Account[]),
      ])
      setDebts(debtData)
      setPayments(paymentData)
      setSubaccounts(subaccountData)
      setInstallments(installmentData)
      setAccounts(accountData)
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
    const today = new Date().toISOString().slice(0, 10)
    const activeDebts = debts.filter((debt) => debt.status === 'active')
    const openDebts = debts.filter((debt) => debt.status !== 'paid')
    const overdueDebts = openDebts.filter((debt) => isDebtOverdue(debt, today))
    const dueSoonDebts = openDebts.filter((debt) => !isDebtOverdue(debt, today) && isDebtDueSoon(debt, today))
    const futureDebts = openDebts
      .filter((debt) => debt.due_date && debt.due_date >= today)
      .toSorted((first, second) => String(first.due_date).localeCompare(String(second.due_date)))
    const fallbackDueDebts = openDebts
      .filter((debt) => debt.due_date)
      .toSorted((first, second) => String(first.due_date).localeCompare(String(second.due_date)))
    const totalInitial = debts.reduce((total, debt) => total + Number(debt.initial_amount), 0)
    const pending = debts.reduce((total, debt) => total + Number(debt.outstanding_balance), 0)
    const paid = Math.max(0, totalInitial - pending)
    const paymentProgress = totalInitial > 0 ? Math.min(100, Math.round((paid / totalInitial) * 100)) : 0
    const highestPendingDebt = openDebts.toSorted(
      (first, second) => Number(second.outstanding_balance) - Number(first.outstanding_balance),
    )[0] ?? null
    const averageOpenBalance = openDebts.length
      ? openDebts.reduce((total, debt) => total + Number(debt.outstanding_balance), 0) / openDebts.length
      : 0

    const nextDueDebt = futureDebts[0] ?? fallbackDueDebts[0] ?? null
    const paidCount = debts.filter((debt) => debt.status === 'paid').length

    return {
      activeCount: activeDebts.length,
      paidCount,
      pending,
      totalInitial,
      paid,
      nextDueDebt,
      overdueCount: overdueDebts.length,
      overdueDebts,
      dueSoonDebts,
      highestPendingDebt,
      averageOpenBalance,
      paymentProgress,
    }
  }, [debts])

  const visibleDebts = useMemo(() => {
    return debts
      .filter((debt) => statusFilter === 'all' || debt.status === statusFilter)
      .toSorted((first, second) => {
        if (sortBy === 'outstanding_balance') {
          return Number(second.outstanding_balance) - Number(first.outstanding_balance)
        }

        const firstDate = first.due_date ? new Date(first.due_date).getTime() : Number.MAX_SAFE_INTEGER
        const secondDate = second.due_date ? new Date(second.due_date).getTime() : Number.MAX_SAFE_INTEGER
        return firstDate - secondDate
      })
  }, [debts, sortBy, statusFilter])

  const paymentsByDebt = useMemo(() => {
    const rows = new Map<string, DebtPayment[]>()
    payments.forEach((payment) => {
      const current = rows.get(payment.debt_id) ?? []
      current.push(payment)
      rows.set(payment.debt_id, current)
    })
    return rows
  }, [payments])

  const subaccountsByDebt = useMemo(() => {
    const rows = new Map<string, DebtSubaccount[]>()
    subaccounts.forEach((subaccount) => {
      const current = rows.get(subaccount.debt_id) ?? []
      current.push(subaccount)
      rows.set(subaccount.debt_id, current)
    })
    return rows
  }, [subaccounts])

  const installmentsByDebt = useMemo(() => {
    const rows = new Map<string, DebtInstallment[]>()
    installments.forEach((installment) => {
      const current = rows.get(installment.debt_id) ?? []
      current.push(installment)
      rows.set(installment.debt_id, current)
    })
    return rows
  }, [installments])

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
      if (values.type === 'credit_card') {
        if (values.card_last4 && !/^[0-9]{4}$/.test(values.card_last4.trim())) {
          throw new Error('Los ultimos 4 digitos deben tener exactamente 4 numeros.')
        }
        for (const [label, rawValue] of [
          ['limite de credito', values.credit_limit],
          ['balance usado', values.used_balance],
          ['pendiente del ultimo corte', values.statement_balance],
          ['balance DOP', values.balance_dop],
          ['balance USD', values.balance_usd],
          ['pago minimo DOP', values.minimum_payment_dop],
          ['pago minimo USD', values.minimum_payment_usd],
          ['limite DOP', values.credit_limit_dop],
          ['limite USD', values.credit_limit_usd],
        ] as const) {
          if (rawValue.trim()) {
            const numericValue = Number(rawValue)
            if (!Number.isFinite(numericValue) || numericValue < 0) {
              throw new Error(`El ${label} debe ser mayor o igual a 0.`)
            }
          }
        }
        if (values.usd_to_dop_rate.trim()) {
          const rate = Number(values.usd_to_dop_rate)
          if (!Number.isFinite(rate) || rate <= 0) {
            throw new Error('La tasa USD a DOP debe ser mayor que 0.')
          }
        }
        values.subaccounts.forEach((subaccount) => {
          const hasData = subaccount.name.trim() || subaccount.balance.trim() || subaccount.credit_limit.trim()
          if (!hasData) return
          if (!subaccount.name.trim()) {
            throw new Error('Cada subcuenta debe tener un nombre.')
          }
          for (const [label, rawValue] of [
            [`balance de ${subaccount.name}`, subaccount.balance],
            [`limite de ${subaccount.name}`, subaccount.credit_limit],
          ] as const) {
            const numericValue = rawValue.trim() ? Number(rawValue) : 0
            if (!Number.isFinite(numericValue) || numericValue < 0) {
              throw new Error(`El ${label} debe ser mayor o igual a 0.`)
            }
          }
        })
      }

      await saveDebt(user.id, values)
      setSuccess(values.id ? 'Deuda actualizada correctamente.' : 'Deuda registrada correctamente.')
      setValues(initialDebt)
      setShowForm(false)
      await loadDebts()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la deuda.')
    } finally {
      setSubmitting(false)
    }
  }

  function startCreate() {
    setValues(initialDebt)
    setShowForm((current) => !current)
    setError('')
    setSuccess('')
  }

  function startEdit(debt: Debt) {
    setValues(debtToFormValues(debt, subaccountsByDebt.get(debt.id) ?? []))
    setShowForm(true)
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(debt: Debt) {
    if (!user || !window.confirm(`Eliminar la deuda "${debt.name}"? Esta accion no se puede deshacer.`)) return
    setError('')
    setSuccess('')

    try {
      await deleteDebt(user.id, debt.id)
      setSuccess('Deuda eliminada correctamente.')
      await loadDebts()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la deuda.')
    }
  }

  async function markAsPaid(debt: Debt) {
    if (!user || !window.confirm(`Marcar "${debt.name}" como pagada? El saldo pendiente quedara en 0.`)) return
    setError('')
    setSuccess('')

    try {
      await saveDebt(user.id, {
        ...debtToFormValues(debt, subaccountsByDebt.get(debt.id) ?? []),
        outstanding_balance: '0',
        status: 'paid',
      })
      setSuccess('Deuda marcada como pagada.')
      await loadDebts()
    } catch (paidError) {
      setError(paidError instanceof Error ? paidError.message : 'No se pudo marcar la deuda como pagada.')
    }
  }

  async function handleCreateEducationPlan() {
    if (!user) return
    setSubmittingEducationSeed(true)
    setError('')
    setSuccess('')

    try {
      await createEducationDebtSeed(user.id)
      setSuccess('Deuda de educacion y cuotas creadas correctamente.')
      await loadDebts()
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : 'No se pudo crear el plan de educacion.')
    } finally {
      setSubmittingEducationSeed(false)
    }
  }

  async function handlePayInstallment(installment: DebtInstallment) {
    if (!user || installment.status === 'paid') return
    if (!window.confirm(`Marcar como pagada la cuota de ${formatMoney(Number(installment.amount))}?`)) return

    setPayingInstallmentId(installment.id)
    setError('')
    setSuccess('')

    try {
      await payDebtInstallment(user.id, installment.id)
      setSuccess('Cuota pagada correctamente y saldo de deuda actualizado.')
      await loadDebts()
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'No se pudo pagar la cuota.')
    } finally {
      setPayingInstallmentId('')
    }
  }

  function togglePaymentForm(debt: Debt) {
    const nextOpenId = openPaymentDebtId === debt.id ? '' : debt.id
    setOpenPaymentDebtId(nextOpenId)
    if (nextOpenId) {
      setPaymentValues((current) => ({
        ...current,
        [debt.id]: current[debt.id] ?? initialDebtPayment(debt.id),
      }))
    }
    setError('')
    setSuccess('')
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>, debt: Debt) {
    event.preventDefault()
    if (!user) return

    const payment = paymentValues[debt.id] ?? initialDebtPayment(debt.id)
    const amount = Number(payment.amount)
    setSubmittingPaymentId(debt.id)
    setError('')
    setSuccess('')

    try {
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('El pago debe ser mayor que 0.')
      }
      if (amount > Number(debt.outstanding_balance)) {
        throw new Error('El pago no puede ser mayor que el saldo pendiente.')
      }
      if (!payment.payment_date) {
        throw new Error('La fecha del pago es obligatoria.')
      }
      if (payment.create_movement && !payment.account_id) {
        throw new Error('Selecciona la cuenta para crear el movimiento de gasto.')
      }

      await registerDebtPayment(user.id, payment)
      setSuccess(payment.create_movement ? 'Pago y movimiento de gasto registrados correctamente.' : 'Pago registrado correctamente.')
      setPaymentValues((current) => ({ ...current, [debt.id]: initialDebtPayment(debt.id) }))
      setOpenPaymentDebtId('')
      await loadDebts()
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'No se pudo registrar el pago.')
    } finally {
      setSubmittingPaymentId('')
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

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleCreateEducationPlan()}
            disabled={submittingEducationSeed}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-500/30 px-4 py-3 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50 disabled:opacity-60 dark:border-brand-400/30 dark:text-brand-100 dark:hover:bg-brand-500/10"
          >
            {submittingEducationSeed ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <GraduationCap className="h-5 w-5" />}
            Crear plan educacion
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {showForm ? 'Cerrar formulario' : 'Registrar deuda'}
          </button>
        </div>
      </div>

      {error ? <StatusMessage message={error} /> : null}
      {success ? <StatusMessage message={success} variant="success" /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total deuda inicial" value={formatMoney(summary.totalInitial)} icon={ClipboardList} />
        <StatCard title="Total pendiente" value={formatMoney(summary.pending)} icon={CircleDollarSign} tone="coral" />
        <StatCard title="Total pagado" value={formatMoney(summary.paid)} icon={CheckCircle2} />
        <StatCard title="Deudas activas" value={String(summary.activeCount)} icon={ClipboardList} />
        <StatCard title="Deudas pagadas" value={String(summary.paidCount)} icon={ShieldCheck} />
        <StatCard
          title="Mayor saldo pendiente"
          value={summary.highestPendingDebt ? formatMoney(Number(summary.highestPendingDebt.outstanding_balance)) : formatMoney(0)}
          icon={TrendingUp}
          tone="coral"
        />
        <StatCard
          title="Proxima por vencer"
          value={summary.nextDueDebt?.due_date ? `${summary.nextDueDebt.name} - ${formatDate(summary.nextDueDebt.due_date)}` : 'Sin fecha'}
          icon={CalendarClock}
          tone="gold"
        />
        <StatCard title="Deudas vencidas" value={String(summary.overdueCount)} icon={CalendarClock} tone="coral" />
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Progreso general de pago</h3>
            <p className="text-sm text-muted dark:text-slate-400">
              {formatMoney(summary.paid)} pagados de {formatMoney(summary.totalInitial)} registrados.
            </p>
          </div>
          <p className="text-3xl font-semibold text-brand-700 dark:text-brand-100">{summary.paymentProgress}%</p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-brand-600 transition-all dark:bg-brand-400"
            style={{ width: `${summary.paymentProgress}%` }}
          />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <DebtAlertCard
          icon={AlertTriangle}
          title="Deudas vencidas"
          tone="danger"
          debts={summary.overdueDebts}
          emptyText="No tienes deudas vencidas."
        />
        <DebtAlertCard
          icon={CalendarClock}
          title={`Vencen en ${dueSoonDays} dias`}
          tone="warning"
          debts={summary.dueSoonDebts}
          emptyText="No hay vencimientos cercanos."
        />
        <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-coral-50 p-2 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Mayor saldo pendiente</h3>
              <p className="text-sm text-muted dark:text-slate-400">Referencia rapida para priorizar.</p>
            </div>
          </div>
          {summary.highestPendingDebt ? (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
              <p className="font-semibold text-ink dark:text-white">{summary.highestPendingDebt.name}</p>
              <p className="mt-1 text-sm text-muted dark:text-slate-400">{summary.highestPendingDebt.creditor}</p>
              <p className="mt-2 text-lg font-semibold text-coral-600 dark:text-coral-400">
                {formatMoney(Number(summary.highestPendingDebt.outstanding_balance))}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted dark:text-slate-400">No hay saldos pendientes.</p>
          )}
        </article>
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
                {values.id ? 'Actualiza los datos principales de la deuda.' : 'Guarda el compromiso con sus fechas y condiciones principales.'}
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
                <option value="education">Educacion</option>
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
              <span className={labelClass}>Moneda</span>
              <select
                value={values.currency}
                onChange={(event) =>
                  setValues((current) => ({ ...current, currency: event.target.value as DebtFormValues['currency'] }))
                }
                className={`mt-1 ${fieldClass}`}
              >
                <option value="DOP">RD$ - Peso dominicano</option>
                <option value="USD">US$ - Dolar estadounidense</option>
                <option value="EUR">Euro</option>
                <option value="BOB">Bs - Bolivar</option>
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Estado</span>
              <select
                value={values.status}
                onChange={(event) =>
                  setValues((current) => ({ ...current, status: event.target.value as DebtFormValues['status'] }))
                }
                className={`mt-1 ${fieldClass}`}
              >
                <option value="active">Activa</option>
                <option value="paid">Pagada</option>
                <option value="overdue">Vencida</option>
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
              <span className={labelClass}>
                {values.type === 'credit_card' ? 'Fecha limite de pago' : 'Fecha de vencimiento'}
              </span>
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

            {values.type === 'credit_card' ? (
              <section className="rounded-lg border border-line bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 lg:col-span-2">
                <div>
                  <h4 className="font-semibold text-ink dark:text-white">Datos de tarjeta de credito</h4>
                  <p className="mt-1 text-sm text-muted dark:text-slate-400">
                    Registra balances en DOP y USD, limites, corte, estado especial y subcuentas del producto.
                  </p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Ultimos 4 digitos</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={values.card_last4}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, card_last4: event.target.value.replace(/\D/g, '').slice(0, 4) }))
                      }
                      className={`mt-1 ${fieldClass}`}
                      placeholder="3423"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Balance DOP</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.balance_dop}
                      onChange={(event) => setValues((current) => ({ ...current, balance_dop: event.target.value }))}
                      className={`mt-1 ${fieldClass}`}
                      placeholder="35736.82"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Balance USD</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.balance_usd}
                      onChange={(event) => setValues((current) => ({ ...current, balance_usd: event.target.value }))}
                      className={`mt-1 ${fieldClass}`}
                      placeholder="0.00"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Limite DOP</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.credit_limit_dop}
                      onChange={(event) => setValues((current) => ({ ...current, credit_limit_dop: event.target.value }))}
                      className={`mt-1 ${fieldClass}`}
                      placeholder="26000.00"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Limite USD</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.credit_limit_usd}
                      onChange={(event) => setValues((current) => ({ ...current, credit_limit_usd: event.target.value }))}
                      className={`mt-1 ${fieldClass}`}
                      placeholder="0.00"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Pago minimo DOP</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.minimum_payment_dop}
                      onChange={(event) => setValues((current) => ({ ...current, minimum_payment_dop: event.target.value }))}
                      className={`mt-1 ${fieldClass}`}
                      placeholder="12054.60"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Pago minimo USD</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.minimum_payment_usd}
                      onChange={(event) => setValues((current) => ({ ...current, minimum_payment_usd: event.target.value }))}
                      className={`mt-1 ${fieldClass}`}
                      placeholder="0.00"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Tasa USD a DOP</span>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={values.usd_to_dop_rate}
                      onChange={(event) => setValues((current) => ({ ...current, usd_to_dop_rate: event.target.value }))}
                      className={`mt-1 ${fieldClass}`}
                      placeholder="59.00"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Limite de credito principal</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.credit_limit}
                      onChange={(event) => setValues((current) => ({ ...current, credit_limit: event.target.value }))}
                      className={`mt-1 ${fieldClass}`}
                      placeholder="26000.00"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Balance usado principal</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.used_balance}
                      onChange={(event) => setValues((current) => ({ ...current, used_balance: event.target.value }))}
                      className={`mt-1 ${fieldClass}`}
                      placeholder="35736.82"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Pendiente ultimo corte principal</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.statement_balance}
                      onChange={(event) => setValues((current) => ({ ...current, statement_balance: event.target.value }))}
                      className={`mt-1 ${fieldClass}`}
                      placeholder="35736.82"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Fecha de corte</span>
                    <input
                      type="date"
                      value={values.statement_date}
                      onChange={(event) => setValues((current) => ({ ...current, statement_date: event.target.value }))}
                      className={`mt-1 ${fieldClass}`}
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Estado especial</span>
                    <select
                      value={values.credit_card_status}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          credit_card_status: event.target.value as DebtFormValues['credit_card_status'],
                        }))
                      }
                      className={`mt-1 ${fieldClass}`}
                    >
                      <option value="">Sin estado</option>
                      <option value="al_dia">Al dia</option>
                      <option value="vencida">Vencida</option>
                      <option value="mora">En mora</option>
                      <option value="sobregirada">Sobregirada</option>
                    </select>
                  </label>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h5 className="text-sm font-semibold text-ink dark:text-white">Subcuentas</h5>
                        <p className="text-xs text-muted dark:text-slate-400">
                          Componentes relacionados como Credimas, avances, cuotas o financiamientos.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setValues((current) => ({
                            ...current,
                            subaccounts: [...current.subaccounts, { name: '', balance: '', credit_limit: '' }],
                          }))
                        }
                        className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Agregar
                      </button>
                    </div>
                    <div className="mt-3 space-y-3">
                      {values.subaccounts.map((subaccount, index) => {
                        const balance = Number(subaccount.balance || 0)
                        const limit = Number(subaccount.credit_limit || 0)
                        const available = limit - balance
                        return (
                          <div key={`${subaccount.name}-${index}`} className="grid gap-3 rounded-lg border border-line bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1.2fr_1fr_1fr_auto]">
                            <label className="block">
                              <span className={labelClass}>Nombre</span>
                              <input
                                type="text"
                                value={subaccount.name}
                                onChange={(event) =>
                                  setValues((current) => ({
                                    ...current,
                                    subaccounts: current.subaccounts.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, name: event.target.value } : item,
                                    ),
                                  }))
                                }
                                className={`mt-1 ${fieldClass}`}
                                placeholder="Credimas"
                              />
                            </label>
                            <label className="block">
                              <span className={labelClass}>Balance</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={subaccount.balance}
                                onChange={(event) =>
                                  setValues((current) => ({
                                    ...current,
                                    subaccounts: current.subaccounts.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, balance: event.target.value } : item,
                                    ),
                                  }))
                                }
                                className={`mt-1 ${fieldClass}`}
                                placeholder="0.00"
                              />
                            </label>
                            <label className="block">
                              <span className={labelClass}>Limite</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={subaccount.credit_limit}
                                onChange={(event) =>
                                  setValues((current) => ({
                                    ...current,
                                    subaccounts: current.subaccounts.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, credit_limit: event.target.value } : item,
                                    ),
                                  }))
                                }
                                className={`mt-1 ${fieldClass}`}
                                placeholder="0.00"
                              />
                              <span className={`mt-1 block text-xs font-medium ${available < 0 ? 'text-coral-600 dark:text-coral-400' : 'text-muted dark:text-slate-400'}`}>
                                Disponible: {Number.isFinite(available) ? formatMoney(available) : formatMoney(0)}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setValues((current) => ({
                                  ...current,
                                  subaccounts: current.subaccounts.filter((_, itemIndex) => itemIndex !== index),
                                }))
                              }
                              className="self-end rounded-lg border border-coral-500/30 px-3 py-2 text-sm font-semibold text-coral-600 hover:bg-coral-50 dark:border-coral-500/30 dark:text-coral-400 dark:hover:bg-coral-500/10"
                            >
                              Quitar
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

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
                {values.id ? 'Actualizar deuda' : 'Guardar deuda'}
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

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Filtrar por estado</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as DebtStatusFilter)}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="paid">Pagadas</option>
              <option value="overdue">Vencidas</option>
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Ordenar por</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as DebtSort)}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="due_date">Fecha de vencimiento</option>
              <option value="outstanding_balance">Saldo pendiente</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-muted dark:text-slate-400">Cargando deudas...</p>
        ) : visibleDebts.length ? (
          <div className="space-y-3">
            {visibleDebts.map((debt) => (
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
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusTone(debt.status)}`}>
                    {debtStatusLabel(debt.status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityTone(debtPriority(debt, summary.averageOpenBalance))}`}>
                    Prioridad {debtPriorityLabel(debtPriority(debt, summary.averageOpenBalance))}
                  </span>
                  {isDebtOverdue(debt) ? (
                    <span className="rounded-full bg-coral-50 px-3 py-1 text-xs font-semibold text-coral-600 dark:bg-coral-500/15 dark:text-coral-400">
                      Vencida
                    </span>
                  ) : isDebtDueSoon(debt) ? (
                    <span className="rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-600 dark:bg-gold-500/15 dark:text-gold-400">
                      Vence pronto
                    </span>
                  ) : null}
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-5">
                  <DebtMetric label="Saldo pendiente" value={formatMoney(Number(debt.outstanding_balance))} />
                  <DebtMetric label="Monto inicial" value={formatMoney(Number(debt.initial_amount))} />
                  <DebtMetric label="Progreso pagado" value={`${debtProgress(debt)}%`} />
                  <DebtMetric label="Moneda" value={debt.currency ?? 'DOP'} />
                  <DebtMetric label="Frecuencia" value={debtFrequencyLabel(debt.payment_frequency)} />
                  <DebtMetric
                    label={debt.type === 'credit_card' ? 'Limite de pago' : 'Vencimiento'}
                    value={debt.due_date ? formatDate(debt.due_date) : 'Sin fecha'}
                  />
                </dl>

                {debt.type === 'credit_card' ? (
                  <CreditCardDebtDetails debt={debt} subaccounts={subaccountsByDebt.get(debt.id) ?? []} />
                ) : null}

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand-600 dark:bg-brand-400"
                    style={{ width: `${debtProgress(debt)}%` }}
                  />
                </div>

                {debt.notes ? (
                  <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-muted dark:bg-slate-950 dark:text-slate-400">
                    {debt.notes}
                  </p>
                ) : null}

                {(installmentsByDebt.get(debt.id) ?? []).length ? (
                  <DebtInstallmentsPanel
                    installments={installmentsByDebt.get(debt.id) ?? []}
                    payingInstallmentId={payingInstallmentId}
                    onPay={(installment) => void handlePayInstallment(installment)}
                  />
                ) : null}

                <div className="mt-4 rounded-lg border border-line bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-brand-700 dark:text-brand-100" />
                      <div>
                        <h4 className="text-sm font-semibold text-ink dark:text-white">Historial de pagos</h4>
                        <p className="text-xs text-muted dark:text-slate-400">
                          {(paymentsByDebt.get(debt.id) ?? []).length} pago(s) registrados
                        </p>
                      </div>
                    </div>
                    {debt.status !== 'paid' && Number(debt.outstanding_balance) > 0 ? (
                      <button
                        type="button"
                        onClick={() => togglePaymentForm(debt)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-500/30 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-400/30 dark:text-brand-100 dark:hover:bg-brand-500/10"
                      >
                        <WalletCards className="h-4 w-4" />
                        {openPaymentDebtId === debt.id ? 'Cerrar pago' : 'Registrar pago'}
                      </button>
                    ) : null}
                  </div>

                  {openPaymentDebtId === debt.id ? (
                    <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => void handlePaymentSubmit(event, debt)}>
                      <label className="block">
                        <span className={labelClass}>Monto pagado</span>
                        <input
                          type="number"
                          required
                          min="0.01"
                          max={Number(debt.outstanding_balance)}
                          step="0.01"
                          value={paymentValues[debt.id]?.amount ?? ''}
                          onChange={(event) =>
                            setPaymentValues((current) => ({
                              ...current,
                              [debt.id]: {
                                ...(current[debt.id] ?? initialDebtPayment(debt.id)),
                                amount: event.target.value,
                              },
                            }))
                          }
                          className={`mt-1 ${fieldClass}`}
                          placeholder="0.00"
                        />
                      </label>

                      <label className="block">
                        <span className={labelClass}>Fecha del pago</span>
                        <input
                          type="date"
                          required
                          value={paymentValues[debt.id]?.payment_date ?? initialDebtPayment(debt.id).payment_date}
                          onChange={(event) =>
                            setPaymentValues((current) => ({
                              ...current,
                              [debt.id]: {
                                ...(current[debt.id] ?? initialDebtPayment(debt.id)),
                                payment_date: event.target.value,
                              },
                            }))
                          }
                          className={`mt-1 ${fieldClass}`}
                        />
                      </label>

                      <label className="block">
                        <span className={labelClass}>Metodo de pago opcional</span>
                        <select
                          value={paymentValues[debt.id]?.payment_method ?? ''}
                          onChange={(event) =>
                            setPaymentValues((current) => ({
                              ...current,
                              [debt.id]: {
                                ...(current[debt.id] ?? initialDebtPayment(debt.id)),
                                payment_method: event.target.value as DebtPaymentFormValues['payment_method'],
                              },
                            }))
                          }
                          className={`mt-1 ${fieldClass}`}
                        >
                          <option value="">Sin metodo</option>
                          <option value="cash">Efectivo</option>
                          <option value="card">Tarjeta</option>
                          <option value="transfer">Transferencia</option>
                          <option value="other">Otro</option>
                        </select>
                      </label>

                      <label className="flex items-start gap-3 rounded-lg border border-line bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:col-span-2">
                        <input
                          type="checkbox"
                          checked={paymentValues[debt.id]?.create_movement ?? false}
                          onChange={(event) =>
                            setPaymentValues((current) => ({
                              ...current,
                              [debt.id]: {
                                ...(current[debt.id] ?? initialDebtPayment(debt.id)),
                                create_movement: event.target.checked,
                              },
                            }))
                          }
                          className="mt-1 h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-ink dark:text-white">
                            Crear movimiento de gasto automaticamente
                          </span>
                          <span className="mt-1 block text-xs text-muted dark:text-slate-400">
                            Se usara la categoria Pago de deuda. Si no existe, la app la creara sin afectar tus datos actuales.
                          </span>
                        </span>
                      </label>

                      {paymentValues[debt.id]?.create_movement ? (
                        <label className="block md:col-span-2">
                          <span className={labelClass}>Cuenta del movimiento</span>
                          <select
                            required
                            value={paymentValues[debt.id]?.account_id ?? ''}
                            onChange={(event) =>
                              setPaymentValues((current) => ({
                                ...current,
                                [debt.id]: {
                                  ...(current[debt.id] ?? initialDebtPayment(debt.id)),
                                  account_id: event.target.value,
                                },
                              }))
                            }
                            className={`mt-1 ${fieldClass}`}
                          >
                            <option value="">Selecciona una cuenta</option>
                            {accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </select>
                          {!accounts.length ? (
                            <p className="mt-2 text-xs text-coral-600 dark:text-coral-400">
                              Crea una cuenta primero para poder registrar el movimiento relacionado.
                            </p>
                          ) : null}
                        </label>
                      ) : null}

                      <label className="block">
                        <span className={labelClass}>Nota opcional</span>
                        <input
                          type="text"
                          value={paymentValues[debt.id]?.note ?? ''}
                          onChange={(event) =>
                            setPaymentValues((current) => ({
                              ...current,
                              [debt.id]: {
                                ...(current[debt.id] ?? initialDebtPayment(debt.id)),
                                note: event.target.value,
                              },
                            }))
                          }
                          className={`mt-1 ${fieldClass}`}
                          placeholder="Ej. cuota de mayo"
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={submittingPaymentId === debt.id}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 md:col-span-2"
                      >
                        {submittingPaymentId === debt.id ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        Guardar pago
                      </button>
                    </form>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {(paymentsByDebt.get(debt.id) ?? []).length ? (
                      (paymentsByDebt.get(debt.id) ?? []).map((payment) => (
                        <div
                          key={payment.id}
                          className="flex flex-col gap-2 rounded-lg border border-line bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-ink dark:text-white">{formatMoney(Number(payment.amount))}</p>
                            <p className="text-xs text-muted dark:text-slate-400">
                              {formatDate(payment.payment_date)}
                              {payment.payment_method ? ` - ${paymentMethodLabel(payment.payment_method)}` : ''}
                            </p>
                            {payment.note ? <p className="mt-1 text-xs text-muted dark:text-slate-400">{payment.note}</p> : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted dark:text-slate-400">Todavia no hay pagos registrados para esta deuda.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => startEdit(debt)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Edit2 className="h-4 w-4" />
                    Editar
                  </button>
                  {debt.status !== 'paid' ? (
                    <button
                      type="button"
                      onClick={() => void markAsPaid(debt)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-500/30 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-400/30 dark:text-brand-100 dark:hover:bg-brand-500/10"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Marcar pagada
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleDelete(debt)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-coral-500/30 px-3 py-2 text-sm font-semibold text-coral-600 hover:bg-coral-50 dark:border-coral-500/30 dark:text-coral-400 dark:hover:bg-coral-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : debts.length ? (
          <EmptyState
            title="No hay deudas con este filtro"
            detail="Cambia el estado seleccionado para ver otros registros."
          />
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

function debtToFormValues(debt: Debt, subaccounts: DebtSubaccount[] = []): DebtFormValues {
  return {
    id: debt.id,
    name: debt.name,
    type: debt.type,
    creditor: debt.creditor,
    currency: debt.currency ?? 'DOP',
    initial_amount: String(debt.initial_amount),
    outstanding_balance: String(debt.outstanding_balance),
    start_date: debt.start_date,
    due_date: debt.due_date ?? '',
    interest_rate: debt.interest_rate == null ? '' : String(debt.interest_rate),
    minimum_payment: debt.minimum_payment == null ? '' : String(debt.minimum_payment),
    card_last4: debt.card_last4 ?? '',
    credit_limit: debt.credit_limit == null ? '' : String(debt.credit_limit),
    used_balance: debt.used_balance == null ? '' : String(debt.used_balance),
    statement_balance: debt.statement_balance == null ? '' : String(debt.statement_balance),
    balance_dop: debt.balance_dop == null ? '' : String(debt.balance_dop),
    balance_usd: debt.balance_usd == null ? '' : String(debt.balance_usd),
    minimum_payment_dop: debt.minimum_payment_dop == null ? '' : String(debt.minimum_payment_dop),
    minimum_payment_usd: debt.minimum_payment_usd == null ? '' : String(debt.minimum_payment_usd),
    credit_limit_dop: debt.credit_limit_dop == null ? '' : String(debt.credit_limit_dop),
    credit_limit_usd: debt.credit_limit_usd == null ? '' : String(debt.credit_limit_usd),
    usd_to_dop_rate: debt.usd_to_dop_rate == null ? '' : String(debt.usd_to_dop_rate),
    statement_date: debt.statement_date ?? '',
    credit_card_status: debt.credit_card_status ?? '',
    subaccounts: subaccounts.length
      ? subaccounts.map((subaccount) => ({
          id: subaccount.id,
          name: subaccount.name,
          balance: String(subaccount.balance),
          credit_limit: String(subaccount.credit_limit),
        }))
      : defaultCardSubaccounts,
    payment_frequency: debt.payment_frequency,
    status: debt.status,
    notes: debt.notes ?? '',
  }
}

function debtProgress(debt: Debt) {
  const initialAmount = Number(debt.initial_amount)
  if (initialAmount <= 0) return debt.status === 'paid' ? 100 : 0
  const paid = Math.max(0, initialAmount - Number(debt.outstanding_balance))
  return Math.min(100, Math.round((paid / initialAmount) * 100))
}

function statusTone(status: DebtStatus) {
  if (status === 'paid') return 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
  if (status === 'overdue') return 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
  return 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400'
}

function isDebtOverdue(debt: Debt, today = new Date().toISOString().slice(0, 10)) {
  return debt.status !== 'paid' && (debt.status === 'overdue' || Boolean(debt.due_date && debt.due_date < today))
}

function isDebtDueSoon(debt: Debt, today = new Date().toISOString().slice(0, 10)) {
  if (debt.status === 'paid' || !debt.due_date) return false
  const days = daysBetween(today, debt.due_date)
  return days >= 0 && days <= dueSoonDays
}

function daysBetween(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`)
  const toDate = new Date(`${to}T00:00:00`)
  return Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000)
}

type DebtPriority = 'high' | 'medium' | 'low'

function debtPriority(debt: Debt, averageOpenBalance: number): DebtPriority {
  if (isDebtOverdue(debt) || isDebtDueSoon(debt)) return 'high'
  if (Number(debt.outstanding_balance) >= averageOpenBalance && averageOpenBalance > 0) return 'medium'
  return 'low'
}

function debtPriorityLabel(priority: DebtPriority) {
  const labels = {
    high: 'alta',
    medium: 'media',
    low: 'baja',
  }
  return labels[priority]
}

function priorityTone(priority: DebtPriority) {
  if (priority === 'high') return 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
  if (priority === 'medium') return 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400'
  return 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
}

function creditCardStatusTone(status: Debt['credit_card_status']) {
  if (status === 'mora' || status === 'sobregirada') return 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
  if (status === 'vencida') return 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400'
  return 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
}

const dopFormatter = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })
const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function formatDop(value: number) {
  return dopFormatter.format(value)
}

function formatUsd(value: number) {
  return usdFormatter.format(value)
}

function toNumber(value: number | null | undefined) {
  return value === null || value === undefined ? 0 : Number(value)
}

function CreditCardDebtDetails({ debt, subaccounts }: { debt: Debt; subaccounts: DebtSubaccount[] }) {
  const dopBalance = toNumber(debt.balance_dop ?? debt.used_balance ?? debt.outstanding_balance)
  const usdBalance = toNumber(debt.balance_usd)
  const dopLimit = toNumber(debt.credit_limit_dop ?? debt.credit_limit)
  const usdLimit = toNumber(debt.credit_limit_usd)
  const dopMinimum = toNumber(debt.minimum_payment_dop ?? debt.minimum_payment)
  const usdMinimum = toNumber(debt.minimum_payment_usd)
  const rate = toNumber(debt.usd_to_dop_rate)
  const dopAvailable = dopLimit - dopBalance
  const usdAvailable = usdLimit - usdBalance
  const usdConverted = rate > 0 ? usdBalance * rate : null
  const totalConsolidated = dopBalance + (usdConverted ?? 0)
  const minimumTotal = dopMinimum + (rate > 0 ? usdMinimum * rate : 0)
  const utilization = dopLimit + (rate > 0 ? usdLimit * rate : 0) > 0
    ? Math.round((totalConsolidated / (dopLimit + (rate > 0 ? usdLimit * rate : 0))) * 100)
    : null
  const hasOverLimit = dopAvailable < 0 || usdAvailable < 0 || debt.credit_card_status === 'sobregirada'

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-line bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className={`p-4 ${hasOverLimit ? 'bg-coral-50 dark:bg-coral-500/10' : 'bg-brand-50 dark:bg-brand-500/10'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${hasOverLimit ? 'bg-coral-100 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400' : 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'}`}>
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-ink dark:text-white">
                Tarjeta de credito{debt.card_last4 ? ` - ${debt.card_last4}` : ''}
              </h4>
              <p className="text-sm text-muted dark:text-slate-400">
                Corte {debt.statement_date ? formatDate(debt.statement_date) : 'sin fecha'} - Pago limite {debt.due_date ? formatDate(debt.due_date) : 'sin fecha'}
              </p>
            </div>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${creditCardStatusTone(debt.credit_card_status)}`}>
            {creditCardDebtStatusLabel(debt.credit_card_status)}
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted dark:text-slate-400">
            <span>Utilizacion consolidada</span>
            <span>{utilization === null ? 'Sin limite' : `${utilization}%`}</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/80 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${hasOverLimit ? 'bg-coral-500' : utilization !== null && utilization >= 80 ? 'bg-gold-500' : 'bg-brand-600'}`}
              style={{ width: `${Math.min(100, utilization ?? 0)}%` }}
            />
          </div>
        </div>
      </div>

      {hasOverLimit ? (
        <div className="border-t border-coral-200 bg-coral-50 px-4 py-3 text-sm font-medium text-coral-700 dark:border-coral-500/20 dark:bg-coral-500/10 dark:text-coral-300">
          Esta tarjeta supera el limite disponible. Revisa el balance, pagos vencidos o posibles cargos por mora.
        </div>
      ) : null}

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <DebtMetric label="Deuda consolidada" value={formatDop(totalConsolidated)} />
        <DebtMetric label="USD convertido" value={usdConverted === null ? 'Agrega tasa USD' : formatDop(usdConverted)} />
        <DebtMetric label="Pago minimo total" value={formatDop(minimumTotal)} />
        <DebtMetric label="Tasa USD a DOP" value={rate > 0 ? String(rate) : 'Sin tasa'} />
        <DebtMetric label="Balance DOP" value={formatDop(dopBalance)} />
        <DebtMetric label="Disponible DOP" value={formatDop(dopAvailable)} />
        <DebtMetric label="Balance USD" value={formatUsd(usdBalance)} />
        <DebtMetric label="Disponible USD" value={formatUsd(usdAvailable)} />
        <DebtMetric label="Pendiente ultimo corte" value={debt.statement_balance == null ? 'Sin dato' : formatMoney(Number(debt.statement_balance))} />
        <DebtMetric label="Tasa de interes" value={debt.interest_rate == null ? 'Sin dato' : `${Number(debt.interest_rate)}%`} />
      </div>

      <div className="border-t border-line p-4 dark:border-slate-800">
        <h5 className="text-sm font-semibold text-ink dark:text-white">Subcuentas relacionadas</h5>
        {subaccounts.length ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {subaccounts.map((subaccount) => {
              const limit = Number(subaccount.credit_limit)
              const balance = Number(subaccount.balance)
              const available = Number(subaccount.available)
              const usage = limit > 0 ? Math.round((balance / limit) * 100) : null
              const overLimit = available < 0
              return (
                <div key={subaccount.id} className="rounded-lg border border-line p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink dark:text-white">{subaccount.name}</p>
                      <p className={`text-xs font-medium ${overLimit ? 'text-coral-600 dark:text-coral-400' : 'text-muted dark:text-slate-400'}`}>
                        Disponible {formatMoney(available)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${overLimit ? 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'}`}>
                      {usage === null ? 'Sin limite' : `${usage}%`}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <DebtMetric label="Balance" value={formatMoney(balance)} />
                    <DebtMetric label="Limite" value={formatMoney(limit)} />
                  </dl>
                  {usage !== null ? (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${overLimit ? 'bg-coral-500' : usage >= 80 ? 'bg-gold-500' : 'bg-brand-600'}`}
                        style={{ width: `${Math.min(100, usage)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted dark:text-slate-400">
            Aun no hay subcuentas registradas para esta tarjeta.
          </p>
        )}
      </div>
    </section>
  )
}

function DebtInstallmentsPanel({
  installments,
  payingInstallmentId,
  onPay,
}: {
  installments: DebtInstallment[]
  payingInstallmentId: string
  onPay: (installment: DebtInstallment) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const total = installments.reduce((sum, installment) => sum + Number(installment.amount), 0)
  const paid = installments
    .filter((installment) => installment.status === 'paid')
    .reduce((sum, installment) => sum + Number(installment.amount), 0)
  const progress = total > 0 ? Math.round((paid / total) * 100) : 0

  return (
    <section className="mt-4 rounded-lg border border-line bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-brand-700 dark:text-brand-100" />
          <div>
            <h4 className="text-sm font-semibold text-ink dark:text-white">Cuotas asociadas</h4>
            <p className="text-xs text-muted dark:text-slate-400">
              {installments.length} cuota(s) - {formatMoney(paid)} pagados de {formatMoney(total)}
            </p>
          </div>
        </div>
        <p className="text-lg font-semibold text-brand-700 dark:text-brand-100">{progress}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      <div className="mt-4 space-y-2">
        {installments.map((installment) => {
          const computedStatus = installment.status === 'pending' && installment.due_date && installment.due_date < today
            ? 'overdue'
            : installment.status
          return (
            <div
              key={installment.id}
              className="flex flex-col gap-3 rounded-lg border border-line bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink dark:text-white">{formatMoney(Number(installment.amount))}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${installmentStatusTone(computedStatus)}`}>
                    {debtInstallmentStatusLabel(computedStatus)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted dark:text-slate-400">{installment.description}</p>
                <p className="mt-1 text-xs text-muted dark:text-slate-400">
                  Vence: {installment.due_date ? formatDate(installment.due_date) : 'Sin fecha especifica'}
                  {installment.paid_at ? ` - Pagada: ${formatDate(installment.paid_at)}` : ''}
                </p>
              </div>
              {installment.status !== 'paid' ? (
                <button
                  type="button"
                  onClick={() => onPay(installment)}
                  disabled={payingInstallmentId === installment.id}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {payingInstallmentId === installment.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Pagar cuota
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function installmentStatusTone(status: DebtInstallment['status']) {
  if (status === 'paid') return 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
  if (status === 'overdue') return 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
  return 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400'
}

function DebtAlertCard({
  icon: Icon,
  title,
  tone,
  debts,
  emptyText,
}: {
  icon: typeof AlertTriangle
  title: string
  tone: 'danger' | 'warning'
  debts: Debt[]
  emptyText: string
}) {
  const tones = {
    danger: 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400',
    warning: 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400',
  }

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted dark:text-slate-400">{debts.length} deuda(s)</p>
        </div>
      </div>
      {debts.length ? (
        <div className="mt-4 space-y-2">
          {debts.slice(0, 3).map((debt) => (
            <div key={debt.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink dark:text-white">{debt.name}</p>
                  <p className="text-xs text-muted dark:text-slate-400">
                    {debt.due_date ? formatDate(debt.due_date) : 'Sin fecha'}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">{formatMoney(Number(debt.outstanding_balance))}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted dark:text-slate-400">{emptyText}</p>
      )}
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
