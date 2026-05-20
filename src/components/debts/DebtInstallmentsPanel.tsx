import { CheckCircle2, GraduationCap, LoaderCircle } from 'lucide-react'
import type { DebtInstallment } from '../../types/finance'
import { debtInstallmentStatusLabel, formatDate, formatMoney } from '../../utils/format'

function installmentStatusTone(status: DebtInstallment['status']) {
  if (status === 'paid') return 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
  if (status === 'overdue') return 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
  return 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400'
}

export function DebtInstallmentsPanel({
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
