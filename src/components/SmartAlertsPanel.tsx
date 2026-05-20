import { AlertTriangle, Bell, Info } from 'lucide-react'
import clsx from 'clsx'
import type { SmartAlert } from '../utils/smartAlerts'

const toneStyles = {
  danger: {
    card: 'border-coral-500/30 bg-coral-50 text-coral-700 dark:border-coral-500/30 dark:bg-coral-500/10 dark:text-coral-300',
    icon: 'bg-coral-100 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400',
    Icon: AlertTriangle,
  },
  warning: {
    card: 'border-gold-500/30 bg-gold-50 text-gold-700 dark:border-gold-500/30 dark:bg-gold-500/10 dark:text-gold-300',
    icon: 'bg-gold-100 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400',
    Icon: Bell,
  },
  neutral: {
    card: 'border-line bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
    icon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    Icon: Info,
  },
}

export function SmartAlertsPanel({
  title = 'Alertas inteligentes',
  alerts,
  compact = false,
  emptyText = 'No hay alertas importantes por ahora.',
}: {
  title?: string
  alerts: SmartAlert[]
  compact?: boolean
  emptyText?: string
}) {
  if (!alerts.length) {
    return (
      <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink dark:text-white">{title}</h3>
            <p className="text-sm text-muted dark:text-slate-400">{emptyText}</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink dark:text-white">{title}</h3>
            <p className="text-sm text-muted dark:text-slate-400">
              {alerts.length} alerta{alerts.length === 1 ? '' : 's'} detectada{alerts.length === 1 ? '' : 's'}.
            </p>
          </div>
        </div>
      </div>

      <div className={clsx('grid gap-3', compact ? 'lg:grid-cols-2' : 'xl:grid-cols-2')}>
        {alerts.map((alert) => {
          const tone = toneStyles[alert.tone]
          const Icon = tone.Icon
          return (
            <article key={alert.id} className={clsx('rounded-lg border p-3', tone.card)}>
              <div className="flex items-start gap-3">
                <div className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tone.icon)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{alert.title}</p>
                  <p className="mt-1 text-sm leading-6 opacity-90">{alert.description}</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
