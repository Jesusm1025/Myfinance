import { CreditCard } from 'lucide-react'
import type { Debt, DebtSubaccount } from '../../types/finance'
import { creditCardDebtStatusLabel, formatDate, formatMoney } from '../../utils/format'
import { DebtMetric } from './DebtMetric'

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

function creditCardStatusTone(status: Debt['credit_card_status']) {
  if (status === 'mora' || status === 'sobregirada') return 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
  if (status === 'vencida') return 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400'
  return 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
}

export function CreditCardDebtDetails({ debt, subaccounts }: { debt: Debt; subaccounts: DebtSubaccount[] }) {
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
  const consolidatedLimit = dopLimit + (rate > 0 ? usdLimit * rate : 0)
  const utilization = consolidatedLimit > 0 ? Math.round((totalConsolidated / consolidatedLimit) * 100) : null
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
