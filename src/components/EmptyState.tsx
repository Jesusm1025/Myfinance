import { Inbox } from 'lucide-react'

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
      <Inbox className="mx-auto h-9 w-9 text-muted dark:text-slate-500" />
      <h3 className="mt-3 text-base font-semibold text-ink dark:text-white">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted dark:text-slate-400">{detail}</p>
    </div>
  )
}
