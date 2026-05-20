import { AlertTriangle, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import clsx from 'clsx'

type ConfirmDialogOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
}

type Resolver = (confirmed: boolean) => void

const initialOptions: ConfirmDialogOptions = {
  title: '',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  variant: 'default',
}

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmDialogOptions>(initialOptions)
  const [open, setOpen] = useState(false)
  const resolverRef = useRef<Resolver | null>(null)

  const close = useCallback((confirmed: boolean) => {
    setOpen(false)
    resolverRef.current?.(confirmed)
    resolverRef.current = null
  }, [])

  const confirm = useCallback((nextOptions: ConfirmDialogOptions) => {
    setOptions({
      ...initialOptions,
      ...nextOptions,
    })
    setOpen(true)

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const ConfirmDialog = useCallback(() => {
    if (!open) return null

    const isDanger = options.variant === 'danger'

    return (
      <div className="fixed inset-0 z-[80] grid place-items-end bg-slate-950/45 px-3 py-4 backdrop-blur-[2px] sm:place-items-center sm:p-6">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="w-full max-w-md rounded-xl border border-line bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.24)] dark:border-slate-800 dark:bg-slate-900 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <div
              className={clsx(
                'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                isDanger
                  ? 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
                  : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100',
              )}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="confirm-dialog-title" className="text-lg font-semibold text-ink dark:text-white">
                {options.title}
              </h2>
              {options.description ? (
                <p className="mt-1 text-sm leading-6 text-muted dark:text-slate-400">{options.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => close(false)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Cerrar dialogo"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => close(false)}
              className="rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {options.cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className={clsx(
                'rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm',
                isDanger ? 'bg-coral-600 hover:bg-coral-700' : 'bg-brand-600 hover:bg-brand-700',
              )}
            >
              {options.confirmLabel}
            </button>
          </div>
        </section>
      </div>
    )
  }, [close, open, options])

  return { confirm, ConfirmDialog }
}
