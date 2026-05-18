import { AlertCircle, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

export function StatusMessage({
  message,
  variant = 'error',
}: {
  message: string
  variant?: 'error' | 'success'
}) {
  const isSuccess = variant === 'success'
  const Icon = isSuccess ? CheckCircle2 : AlertCircle

  return (
    <div
      className={clsx(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        isSuccess
          ? 'border-brand-500/30 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-500/10 dark:text-brand-100'
          : 'border-coral-500/30 bg-coral-50 text-coral-600 dark:border-coral-500/30 dark:bg-coral-500/10 dark:text-coral-400',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
