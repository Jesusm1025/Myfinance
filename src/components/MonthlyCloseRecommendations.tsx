import { CheckCircle2, Info, Lightbulb, TriangleAlert } from 'lucide-react'
import clsx from 'clsx'
import type { MonthlyCloseRecommendation } from '../utils/monthlyClose'

const toneStyles = {
  positive: {
    card: 'border-brand-500/30 bg-brand-50 text-brand-800 dark:border-brand-400/30 dark:bg-brand-500/15 dark:text-brand-100',
    icon: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100',
    Icon: CheckCircle2,
  },
  warning: {
    card: 'border-gold-500/30 bg-gold-50 text-gold-800 dark:border-gold-400/30 dark:bg-gold-500/15 dark:text-gold-200',
    icon: 'bg-gold-100 text-gold-700 dark:bg-gold-500/20 dark:text-gold-200',
    Icon: Lightbulb,
  },
  danger: {
    card: 'border-coral-500/30 bg-coral-50 text-coral-800 dark:border-coral-400/30 dark:bg-coral-500/15 dark:text-coral-200',
    icon: 'bg-coral-100 text-coral-700 dark:bg-coral-500/20 dark:text-coral-200',
    Icon: TriangleAlert,
  },
  neutral: {
    card: 'border-line bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
    icon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    Icon: Info,
  },
}

export function MonthlyCloseRecommendations({ recommendations }: { recommendations: MonthlyCloseRecommendation[] }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div>
        <h3 className="text-lg font-semibold text-ink dark:text-white">Recomendaciones para el proximo mes</h3>
        <p className="text-sm text-muted dark:text-slate-400">Reglas simples basadas en tu cierre actual.</p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {recommendations.map((recommendation) => {
          const tone = toneStyles[recommendation.tone]
          const Icon = tone.Icon
          return (
            <article key={recommendation.id} className={clsx('rounded-lg border p-3', tone.card)}>
              <div className="flex items-start gap-3">
                <div className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tone.icon)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">{recommendation.title}</p>
                  <p className="mt-1 text-sm leading-6 opacity-90">{recommendation.description}</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
