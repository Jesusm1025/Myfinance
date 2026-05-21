import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import clsx from 'clsx'
import type { AdvisorInsight } from '../utils/financialAdvisor'

function toneClass(tone: AdvisorInsight['tone']) {
  const classes = {
    positive: 'border-brand-500/25 bg-brand-50 text-brand-700 dark:border-brand-400/20 dark:bg-brand-500/10 dark:text-brand-100',
    warning: 'border-gold-500/25 bg-gold-50 text-gold-700 dark:border-gold-400/20 dark:bg-gold-500/10 dark:text-gold-300',
    danger: 'border-coral-500/25 bg-coral-50 text-coral-700 dark:border-coral-400/20 dark:bg-coral-500/10 dark:text-coral-300',
    neutral: 'border-line bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
  }
  return classes[tone]
}

function ToneIcon({ tone }: { tone: AdvisorInsight['tone'] }) {
  if (tone === 'positive') return <CheckCircle2 className="h-4 w-4" />
  if (tone === 'danger' || tone === 'warning') return <AlertTriangle className="h-4 w-4" />
  return <Info className="h-4 w-4" />
}

export function AdvisorInsightCards({ insights }: { insights: AdvisorInsight[] }) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1 xl:gap-3">
      {insights.map((insight) => (
        <article
          key={insight.id}
          className={clsx('premium-card rounded-lg border p-3 shadow-sm sm:p-4', toneClass(insight.tone))}
        >
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="mt-0.5 hidden sm:block">
              <ToneIcon tone={insight.tone} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-75 sm:text-xs">{insight.label}</p>
              <p className="mt-1 truncate text-sm font-semibold sm:text-lg">{insight.value}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-4 opacity-80 sm:text-sm sm:leading-5">{insight.detail}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}
