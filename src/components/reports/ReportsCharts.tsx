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
import { EmptyState } from '../EmptyState'
import type { CategoryReportRow, MonthlyReportRow } from '../../utils/reports'
import { formatMoney } from '../../utils/format'

export function ReportsCharts({
  expenseCategories,
  monthlyData,
  currentPeriod,
}: {
  expenseCategories: CategoryReportRow[]
  monthlyData: MonthlyReportRow[]
  currentPeriod: string
}) {
  return (
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
  )
}
