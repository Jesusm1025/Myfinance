import clsx from 'clsx'

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800', className)} />
}

export function SkeletonCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className={clsx('h-7', compact ? 'w-24' : 'w-36')} />
        </div>
        <SkeletonBlock className="h-10 w-10 shrink-0" />
      </div>
    </div>
  )
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} compact />
      ))}
    </div>
  )
}

export function SkeletonList({ rows = 3, itemHeight = 'h-20' }: { rows?: number; itemHeight?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock key={index} className={itemHeight} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="hidden border-b border-line p-4 dark:border-slate-800 md:grid md:grid-cols-5 md:gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-4" />
        ))}
      </div>
      <div className="divide-y divide-line dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid gap-3 p-4 md:grid-cols-5 md:items-center">
            <div className="flex items-center gap-3 md:col-span-2">
              <SkeletonBlock className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-3/4" />
                <SkeletonBlock className="h-3 w-1/2" />
              </div>
            </div>
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-8 w-28 md:justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  )
}
