import { AlertTriangle, CheckCircle2, Lightbulb, LoaderCircle, Wand2 } from 'lucide-react'
import clsx from 'clsx'
import type { AutoBudgetConfidence, AutoBudgetSuggestion } from '../utils/autoBudget'
import { formatMoney } from '../utils/format'

function confidenceLabel(confidence: AutoBudgetConfidence) {
  const labels = {
    very_low: 'Muy baja',
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    none: 'Sin datos',
  }
  return labels[confidence]
}

function confidenceClass(confidence: AutoBudgetConfidence) {
  const classes = {
    very_low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    low: 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400',
    medium: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    high: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100',
    none: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  }
  return classes[confidence]
}

function suggestionActionLabel(suggestion: AutoBudgetSuggestion) {
  if (!suggestion.hasEnoughData) return 'Sin datos'
  return suggestion.budget ? 'Actualizar' : 'Aplicar'
}

export function AutoBudgetPanel({
  suggestions,
  applyingId,
  applyingAll,
  onApply,
  onApplyAll,
}: {
  suggestions: AutoBudgetSuggestion[]
  applyingId: string | null
  applyingAll: boolean
  onApply: (suggestion: AutoBudgetSuggestion) => void
  onApplyAll: () => void
}) {
  const applicableSuggestions = suggestions.filter((suggestion) => suggestion.hasEnoughData && suggestion.suggestedAmount)
  const overwriteCount = applicableSuggestions.filter((suggestion) => suggestion.budget).length

  return (
    <section className="rounded-lg border border-line bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-line p-4 dark:border-slate-800 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ink dark:text-white">Presupuesto automatico</h3>
              <p className="mt-1 text-sm text-muted dark:text-slate-400">
                Sugerencias por categoria desde tus gastos reales, incluso con poco historial.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={!applicableSuggestions.length || applyingAll}
            onClick={onApplyAll}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {applyingAll ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aplicar todas
          </button>
        </div>
        {overwriteCount ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-gold-50 px-3 py-2 text-xs font-medium text-gold-700 dark:bg-gold-500/15 dark:text-gold-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Hay {overwriteCount} presupuesto(s) existentes. Aplicar todas pedira confirmacion antes de actualizar.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 p-4 sm:p-5 xl:hidden">
        {suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.category.id}
            suggestion={suggestion}
            applying={applyingId === suggestion.category.id}
            onApply={() => onApply(suggestion)}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <table className="min-w-full divide-y divide-line text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3 text-right">Gasto actual</th>
              <th className="px-4 py-3 text-right">Proyeccion</th>
              <th className="px-4 py-3 text-right">Sugerido</th>
              <th className="px-4 py-3 text-right">Actual</th>
              <th className="px-4 py-3">Confianza</th>
              <th className="px-4 py-3">Explicacion</th>
              <th className="px-4 py-3 text-right">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line dark:divide-slate-800">
            {suggestions.map((suggestion) => (
              <tr key={suggestion.category.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <td className="px-4 py-4">
                  <CategoryLabel suggestion={suggestion} />
                </td>
                <td className="px-4 py-4 text-right font-medium">{formatMoney(suggestion.currentSpent)}</td>
                <td className="px-4 py-4 text-right">{formatMoney(suggestion.monthlyProjection)}</td>
                <td className="px-4 py-4 text-right font-semibold text-brand-700 dark:text-brand-100">
                  {suggestion.suggestedAmount ? formatMoney(suggestion.suggestedAmount) : 'Sin datos'}
                </td>
                <td className="px-4 py-4 text-right">
                  {suggestion.budget ? formatMoney(Number(suggestion.budget.amount)) : 'No definido'}
                </td>
                <td className="px-4 py-4">
                  <ConfidencePill confidence={suggestion.confidence} />
                </td>
                <td className="max-w-xs px-4 py-4 text-muted dark:text-slate-400">
                  {suggestion.explanation}
                  {suggestion.recurringEstimate > 0 ? (
                    <span className="mt-1 block font-medium text-ink dark:text-white">
                      Recurrente: {formatMoney(suggestion.recurringEstimate)}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-right">
                  <ApplyButton
                    suggestion={suggestion}
                    applying={applyingId === suggestion.category.id}
                    onApply={() => onApply(suggestion)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SuggestionCard({
  suggestion,
  applying,
  onApply,
}: {
  suggestion: AutoBudgetSuggestion
  applying: boolean
  onApply: () => void
}) {
  return (
    <article className="rounded-lg border border-line p-4 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <CategoryLabel suggestion={suggestion} />
        <ConfidencePill confidence={suggestion.confidence} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Metric label="Gasto actual" value={formatMoney(suggestion.currentSpent)} />
        <Metric label="Proyeccion mensual" value={formatMoney(suggestion.monthlyProjection)} />
        <Metric
          label="Presupuesto sugerido"
          value={suggestion.suggestedAmount ? formatMoney(suggestion.suggestedAmount) : 'Sin datos'}
          strong
        />
        <Metric label="Presupuesto actual" value={suggestion.budget ? formatMoney(Number(suggestion.budget.amount)) : 'No definido'} />
        {suggestion.recurringEstimate > 0 ? (
          <Metric label="Recurrente estimado" value={formatMoney(suggestion.recurringEstimate)} />
        ) : null}
      </div>
      <p className="mt-3 text-sm text-muted dark:text-slate-400">{suggestion.explanation}</p>
      <ApplyButton suggestion={suggestion} applying={applying} onApply={onApply} className="mt-4 w-full" />
    </article>
  )
}

function CategoryLabel({ suggestion }: { suggestion: AutoBudgetSuggestion }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="h-10 w-10 shrink-0 rounded-lg" style={{ backgroundColor: suggestion.category.color }} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink dark:text-white">{suggestion.category.name}</p>
        <p className="text-xs text-muted dark:text-slate-400">
          Promedio: {formatMoney(suggestion.averageMonthlySpend)} - Maximo: {formatMoney(suggestion.maxMonthlySpend)}
        </p>
      </div>
    </div>
  )
}

function ConfidencePill({ confidence }: { confidence: AutoBudgetConfidence }) {
  return (
    <span className={clsx('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', confidenceClass(confidence))}>
      <Lightbulb className="h-3.5 w-3.5" />
      {confidenceLabel(confidence)}
    </span>
  )
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
      <p className="text-xs text-muted dark:text-slate-400">{label}</p>
      <p className={clsx('mt-1 truncate', strong ? 'font-semibold text-brand-700 dark:text-brand-100' : 'font-medium text-ink dark:text-white')}>
        {value}
      </p>
    </div>
  )
}

function ApplyButton({
  suggestion,
  applying,
  onApply,
  className,
}: {
  suggestion: AutoBudgetSuggestion
  applying: boolean
  onApply: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      disabled={!suggestion.hasEnoughData || !suggestion.suggestedAmount || applying}
      onClick={onApply}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60',
        className,
      )}
    >
      {applying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {suggestionActionLabel(suggestion)}
    </button>
  )
}
