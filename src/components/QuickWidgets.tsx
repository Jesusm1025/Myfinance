import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import clsx from 'clsx'

export type QuickWidgetTone = 'brand' | 'coral' | 'gold' | 'slate'

export type QuickWidget = {
  id: string
  label: string
  value: string
  detail: string
  icon: LucideIcon
  tone?: QuickWidgetTone
}

const toneStyles: Record<QuickWidgetTone, { icon: string; accent: string }> = {
  brand: {
    icon: 'bg-brand-50 text-brand-700 ring-brand-500/10 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-300/10',
    accent: 'bg-brand-500',
  },
  coral: {
    icon: 'bg-coral-50 text-coral-600 ring-coral-500/10 dark:bg-coral-500/15 dark:text-coral-300 dark:ring-coral-300/10',
    accent: 'bg-coral-500',
  },
  gold: {
    icon: 'bg-gold-50 text-gold-600 ring-gold-500/10 dark:bg-gold-500/15 dark:text-gold-300 dark:ring-gold-300/10',
    accent: 'bg-gold-500',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-300/10',
    accent: 'bg-slate-400',
  },
}

export function QuickWidgets({ widgets }: { widgets: QuickWidget[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {widgets.map((widget, index) => {
        const tone = toneStyles[widget.tone ?? 'slate']
        const Icon = widget.icon

        return (
          <article
            key={widget.id}
            className="premium-card group relative overflow-hidden rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <span className={clsx('absolute inset-x-0 top-0 h-0.5 opacity-80', tone.accent)} />
            <div className="flex items-start gap-3">
              <div className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-1', tone.icon)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-slate-400">
                  {widget.label}
                </p>
                <p className="mt-1 truncate text-lg font-semibold text-ink dark:text-white">{widget.value}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
                  {widget.detail}
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-slate-600" />
            </div>
          </article>
        )
      })}
    </section>
  )
}
