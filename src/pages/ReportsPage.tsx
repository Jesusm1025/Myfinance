import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarRange,
  Download,
  FileSpreadsheet,
  FileText,
  ReceiptText,
  Wallet,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState } from '../components/EmptyState'
import { StatCard } from '../components/StatCard'
import { StatusMessage } from '../components/StatusMessage'
import { categoriesChangedEvent, movementsChangedEvent } from '../events/financeEvents'
import { listMovements } from '../services/accounting'
import type { Movement, MovementFilters } from '../types/finance'
import { exportMovementsToCsv, exportReportToExcel, exportSummaryToPdf } from '../utils/reportExports'
import {
  buildReportSummary,
  groupByCategory,
  groupByMonth,
  groupByPaymentMethod,
} from '../utils/reports'
import { currentMonthValue, formatMoney, monthRange } from '../utils/format'

type ReportMode = 'month' | 'range'

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20'

const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'

function periodLabel(mode: ReportMode, month: string, from: string, to: string) {
  if (mode === 'month') {
    return format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: es })
  }
  return `${format(parseISO(from), 'dd MMM yyyy', { locale: es })} a ${format(parseISO(to), 'dd MMM yyyy', { locale: es })}`
}

function fileSuffix(mode: ReportMode, month: string, from: string, to: string) {
  return mode === 'month' ? month : `${from}_a_${to}`
}

export function ReportsPage() {
  const { user } = useAuth()
  const currentRange = monthRange(currentMonthValue())
  const [mode, setMode] = useState<ReportMode>('month')
  const [month, setMonth] = useState(currentMonthValue())
  const [from, setFrom] = useState(currentRange.from)
  const [to, setTo] = useState(currentRange.to)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const filters = useMemo<MovementFilters>(
    () => ({
      month,
      type: 'all',
      categoryId: '',
      paymentMethod: 'all',
      from: mode === 'range' ? from : '',
      to: mode === 'range' ? to : '',
    }),
    [from, mode, month, to],
  )

  const loadReport = useCallback(async () => {
    if (!user) return
    if (mode === 'range' && from > to) {
      setMovements([])
      setLoading(false)
      setError('La fecha inicial no puede ser mayor que la fecha final.')
      return
    }

    setLoading(true)
    setError('')
    try {
      setMovements(await listMovements(user.id, filters))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el reporte.')
    } finally {
      setLoading(false)
    }
  }, [filters, from, mode, to, user])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  useEffect(() => {
    window.addEventListener(movementsChangedEvent, loadReport)
    window.addEventListener(categoriesChangedEvent, loadReport)
    return () => {
      window.removeEventListener(movementsChangedEvent, loadReport)
      window.removeEventListener(categoriesChangedEvent, loadReport)
    }
  }, [loadReport])

  const summary = useMemo(() => buildReportSummary(movements), [movements])
  const categories = useMemo(() => groupByCategory(movements), [movements])
  const paymentMethods = useMemo(() => groupByPaymentMethod(movements), [movements])
  const monthlyData = useMemo(() => groupByMonth(movements), [movements])
  const expenseCategories = useMemo(() => categories.filter((category) => category.expenses > 0), [categories])
  const currentPeriod = useMemo(() => periodLabel(mode, month, from, to), [from, mode, month, to])
  const currentFileSuffix = useMemo(() => fileSuffix(mode, month, from, to), [from, mode, month, to])
  const canExport = !loading && movements.length > 0

  const exportPayload = {
    movements,
    summary,
    categories,
    paymentMethods,
    periodLabel: currentPeriod,
    fileSuffix: currentFileSuffix,
  }

  function handleExport(action: () => void, message: string) {
    setError('')
    setSuccess('')
    try {
      action()
      setSuccess(message)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'No se pudo descargar el reporte.')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100">
            Reportes financieros
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
            Analiza y descarga tus movimientos
          </h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={!canExport}
            onClick={() =>
              handleExport(() => exportMovementsToCsv(exportPayload), 'CSV descargado correctamente.')
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            disabled={!canExport}
            onClick={() =>
              handleExport(() => exportReportToExcel(exportPayload), 'Excel descargado correctamente.')
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            disabled={!canExport}
            onClick={() =>
              handleExport(() => exportSummaryToPdf(exportPayload), 'PDF descargado correctamente.')
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {error ? <StatusMessage message={error} /> : null}
      {success ? <StatusMessage message={success} variant="success" /> : null}

      <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Periodo del reporte</h3>
            <p className="text-sm text-muted dark:text-slate-400">Elige un mes o un rango de fechas.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['month', 'range'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={clsx(
                  'rounded-md px-3 py-2 text-sm font-medium',
                  mode === option
                    ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-100'
                    : 'text-slate-600 dark:text-slate-300',
                )}
              >
                {option === 'month' ? 'Mes' : 'Rango'}
              </button>
            ))}
          </div>

          {mode === 'month' ? (
            <label className="block">
              <span className={labelClass}>Mes visible</span>
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className={`mt-1 ${fieldClass}`}
              />
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Desde</span>
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className={`mt-1 ${fieldClass}`}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Hasta</span>
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className={`mt-1 ${fieldClass}`}
                />
              </label>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Ingresos" value={formatMoney(summary.income)} icon={ArrowUpCircle} />
        <StatCard title="Gastos" value={formatMoney(summary.expenses)} icon={ArrowDownCircle} tone="coral" />
        <StatCard title="Balance" value={formatMoney(summary.balance)} icon={Wallet} tone="gold" />
        <StatCard title="Movimientos" value={String(summary.movementCount)} icon={ReceiptText} />
      </section>

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-80 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-80 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : movements.length ? (
        <>
          <section className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
            <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Gastos por categoria</h3>
                <p className="text-sm text-muted dark:text-slate-400">{currentPeriod}</p>
              </div>
              {expenseCategories.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseCategories} dataKey="expenses" nameKey="name" innerRadius={58} outerRadius={92}>
                        {expenseCategories.map((item) => (
                          <Cell key={item.id} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatMoney(Number(value))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Sin gastos" detail="No hay gastos en el periodo seleccionado." />
              )}
            </article>

            <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Ingresos vs gastos por mes</h3>
                <p className="text-sm text-muted dark:text-slate-400">Agrupado por periodo mensual.</p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                    <Legend />
                    <Bar dataKey="income" name="Ingresos" fill="#198c7c" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenses" name="Gastos" fill="#ee6c4d" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <ReportTable
              title="Total por categoria"
              columns={['Categoria', 'Ingresos', 'Gastos', 'Balance']}
              rows={categories.map((category) => ({
                key: category.id,
                label: category.name,
                income: category.income,
                expenses: category.expenses,
                balance: category.balance,
                color: category.color,
              }))}
            />
            <ReportTable
              title="Total por metodo de pago"
              columns={['Metodo', 'Ingresos', 'Gastos', 'Balance']}
              rows={paymentMethods.map((method) => ({
                key: method.method,
                label: method.name,
                income: method.income,
                expenses: method.expenses,
                balance: method.balance,
              }))}
            />
          </section>
        </>
      ) : (
        <EmptyState
          title="Sin movimientos para reportar"
          detail="Cambia el periodo o registra movimientos para generar reportes y exportaciones."
        />
      )}
    </div>
  )
}

function ReportTable({
  title,
  columns,
  rows,
}: {
  title: string
  columns: [string, string, string, string]
  rows: Array<{
    key: string
    label: string
    income: number
    expenses: number
    balance: number
    color?: string
  }>
}) {
  return (
    <article className="rounded-lg border border-line bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-line p-4 dark:border-slate-800 sm:p-5">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      <div className="divide-y divide-line dark:divide-slate-800 md:hidden">
        {rows.map((row) => (
          <div key={row.key} className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              {row.color ? <span className="h-9 w-9 rounded-lg" style={{ backgroundColor: row.color }} /> : null}
              <p className="font-semibold">{row.label}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <AmountCell label="Ingresos" value={row.income} tone="income" />
              <AmountCell label="Gastos" value={row.expenses} tone="expense" />
              <AmountCell label="Balance" value={row.balance} tone="balance" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-line text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              {columns.map((column, index) => (
                <th key={column} className={clsx('px-4 py-3', index > 0 && 'text-right')}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {row.color ? <span className="h-8 w-8 rounded-lg" style={{ backgroundColor: row.color }} /> : null}
                    <span className="font-medium text-ink dark:text-white">{row.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-brand-700 dark:text-brand-100">
                  {formatMoney(row.income)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-coral-600 dark:text-coral-400">
                  {formatMoney(row.expenses)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                  {formatMoney(row.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function AmountCell({ label, value, tone }: { label: string; value: number; tone: 'income' | 'expense' | 'balance' }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
      <p className="text-xs text-muted dark:text-slate-400">{label}</p>
      <p
        className={clsx(
          'mt-1 truncate font-semibold',
          tone === 'income' && 'text-brand-700 dark:text-brand-100',
          tone === 'expense' && 'text-coral-600 dark:text-coral-400',
          tone === 'balance' && 'text-slate-700 dark:text-slate-200',
        )}
      >
        {formatMoney(value)}
      </p>
    </div>
  )
}
