import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Edit2, Filter, LoaderCircle, Plus, Save, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { SkeletonStats, SkeletonTable } from '../components/Skeleton'
import { StatusMessage } from '../components/StatusMessage'
import { accountsChangedEvent, categoriesChangedEvent, movementsChangedEvent } from '../events/financeEvents'
import {
  deleteMovement,
  listAccounts,
  listCategories,
  listMovements,
  saveMovement,
} from '../services/accounting'
import type { Account, Category, Movement, MovementFilters, MovementFormValues } from '../types/finance'
import {
  currentMonthValue,
  formatDate,
  formatMoney,
  movementTypeLabel,
  paymentMethodLabel,
} from '../utils/format'

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20'

const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'

const initialMovement: MovementFormValues = {
  type: 'expense',
  amount: '',
  category_id: '',
  account_id: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
  payment_method: 'cash',
}

const initialFilters: MovementFilters = {
  month: currentMonthValue(),
  type: 'all',
  categoryId: '',
  accountId: '',
  paymentMethod: 'all',
  from: '',
  to: '',
}

export function MovementsPage() {
  const { user } = useAuth()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [movements, setMovements] = useState<Movement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [values, setValues] = useState<MovementFormValues>(initialMovement)
  const [filters, setFilters] = useState<MovementFilters>(initialFilters)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [movementData, categoryData, accountData] = await Promise.all([
        listMovements(user.id, filters),
        listCategories(user.id),
        listAccounts(user.id).catch(() => [] as Account[]),
      ])
      setMovements(movementData)
      setCategories(categoryData)
      setAccounts(accountData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los movimientos.')
    } finally {
      setLoading(false)
    }
  }, [filters, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    window.addEventListener(movementsChangedEvent, refresh)
    window.addEventListener(categoriesChangedEvent, refresh)
    window.addEventListener(accountsChangedEvent, refresh)
    return () => {
      window.removeEventListener(movementsChangedEvent, refresh)
      window.removeEventListener(categoriesChangedEvent, refresh)
      window.removeEventListener(accountsChangedEvent, refresh)
    }
  }, [refresh])

  const compatibleCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.type === values.type,
      ),
    [categories, values.type],
  )

  const totals = useMemo(() => {
    const income = movements
      .filter((movement) => movement.type === 'income')
      .reduce((total, movement) => total + Number(movement.amount), 0)
    const expenses = movements
      .filter((movement) => movement.type === 'expense')
      .reduce((total, movement) => total + Number(movement.amount), 0)
    return { income, expenses }
  }, [movements])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const amount = Number(values.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('El monto debe ser mayor que 0.')
      }
      if (!values.category_id) {
        throw new Error('La categoria es obligatoria.')
      }
      if (!values.account_id) {
        throw new Error('La cuenta es obligatoria.')
      }
      if (!values.date) {
        throw new Error('La fecha es obligatoria.')
      }

      await saveMovement(user.id, values)
      setSuccess(values.id ? 'Movimiento actualizado correctamente.' : 'Movimiento creado correctamente.')
      setValues(initialMovement)
      await refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el movimiento.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(movement: Movement) {
    if (!user) return
    const confirmed = await confirm({
      title: 'Eliminar movimiento',
      description: 'Este movimiento se eliminara de tu historial. Esta accion no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!confirmed) return
    setError('')
    setSuccess('')
    try {
      await deleteMovement(user.id, movement.id)
      setSuccess('Movimiento eliminado correctamente.')
      await refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el movimiento.')
    }
  }

  function editMovement(movement: Movement) {
    setValues({
      id: movement.id,
      type: movement.type,
      amount: String(movement.amount),
      category_id: movement.category_id ?? '',
      account_id: movement.account_id ?? '',
      description: movement.description ?? '',
      date: movement.date,
      payment_method: movement.payment_method,
    })
  }

  return (
    <>
      <ConfirmDialog />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{values.id ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
            <p className="text-sm text-muted dark:text-slate-400">Registra ingresos y gastos personales.</p>
          </div>
        </div>

        {error ? <div className="mt-4"><StatusMessage message={error} /></div> : null}
        {success ? <div className="mt-4"><StatusMessage message={success} variant="success" /></div> : null}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['expense', 'income'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setValues((current) => ({ ...current, type, category_id: '' }))}
                className={clsx(
                  'rounded-md px-3 py-2 text-sm font-medium',
                  values.type === type
                    ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-100'
                    : 'text-slate-600 dark:text-slate-300',
                )}
              >
                {movementTypeLabel(type)}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <label className="block">
              <span className={labelClass}>Monto</span>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={values.amount}
                onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))}
                className={`mt-1 ${fieldClass}`}
                placeholder="0.00"
              />
            </label>

            <label className="block">
              <span className={labelClass}>Fecha</span>
              <input
                type="date"
                required
                value={values.date}
                onChange={(event) => setValues((current) => ({ ...current, date: event.target.value }))}
                className={`mt-1 ${fieldClass}`}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>Categoria</span>
            <select
              required
              value={values.category_id}
              onChange={(event) => setValues((current) => ({ ...current, category_id: event.target.value }))}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="">Selecciona una categoria</option>
              {compatibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Cuenta</span>
            <select
              required
              value={values.account_id}
              onChange={(event) => setValues((current) => ({ ...current, account_id: event.target.value }))}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="">Selecciona una cuenta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Metodo de pago</span>
            <select
              value={values.payment_method}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  payment_method: event.target.value as MovementFormValues['payment_method'],
                }))
              }
              className={`mt-1 ${fieldClass}`}
            >
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
              <option value="other">Otro</option>
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Descripcion</span>
            <textarea
              value={values.description}
              onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
              className={`mt-1 min-h-24 resize-y ${fieldClass}`}
              placeholder="Detalle opcional"
            />
          </label>

          <div className="fixed inset-x-4 bottom-24 z-30 flex gap-2 rounded-lg bg-white/95 py-2 backdrop-blur dark:bg-slate-900/95 sm:static sm:inset-auto sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              Guardar
            </button>
            {values.id ? (
              <button
                type="button"
                onClick={() => setValues(initialMovement)}
                className="rounded-lg border border-line px-4 py-3 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Cancelar edicion"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Filtros</h2>
              <p className="text-sm text-muted dark:text-slate-400">Busca por mes, tipo, categoria o rango.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <input
              type="month"
              value={filters.month}
              onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}
              className={fieldClass}
              aria-label="Filtrar por mes"
            />
            <select
              value={filters.type}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  type: event.target.value as MovementFilters['type'],
                }))
              }
              className={fieldClass}
              aria-label="Filtrar por tipo"
            >
              <option value="all">Todos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Gastos</option>
            </select>
            <select
              value={filters.categoryId}
              onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}
              className={fieldClass}
              aria-label="Filtrar por categoria"
            >
              <option value="">Categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={filters.accountId}
              onChange={(event) => setFilters((current) => ({ ...current, accountId: event.target.value }))}
              className={fieldClass}
              aria-label="Filtrar por cuenta"
            >
              <option value="">Cuentas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <select
              value={filters.paymentMethod}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  paymentMethod: event.target.value as MovementFilters['paymentMethod'],
                }))
              }
              className={fieldClass}
              aria-label="Filtrar por metodo de pago"
            >
              <option value="all">Metodos de pago</option>
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
              <option value="other">Otro</option>
            </select>
          </div>
        </div>

        {loading ? (
          <SkeletonStats count={2} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-muted dark:text-slate-400">Ingresos filtrados</p>
              <p className="mt-1 text-xl font-semibold text-brand-700 dark:text-brand-100">{formatMoney(totals.income)}</p>
            </div>
            <div className="rounded-lg border border-line bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-muted dark:text-slate-400">Gastos filtrados</p>
              <p className="mt-1 text-xl font-semibold text-coral-600 dark:text-coral-400">{formatMoney(totals.expenses)}</p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-line bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : movements.length ? (
            <>
              <div className="divide-y divide-line dark:divide-slate-800 md:hidden">
                {movements.map((movement) => (
                  <article key={movement.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 h-10 w-10 rounded-lg"
                        style={{ backgroundColor: movement.category?.color ?? '#64748b' }}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold dark:text-white">
                            {movement.description || movement.category?.name || 'Movimiento'}
                          </h3>
                          <span
                            className={clsx(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              movement.type === 'income'
                                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
                                : 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400',
                            )}
                          >
                            {movementTypeLabel(movement.type)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted dark:text-slate-400">
                          {formatDate(movement.date)} - {movement.category?.name ?? 'Sin categoria'} -{' '}
                          {movement.account?.name ?? 'Sin cuenta'} -{' '}
                          {paymentMethodLabel(movement.payment_method)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={clsx(
                          'text-lg font-semibold',
                          movement.type === 'income'
                            ? 'text-brand-700 dark:text-brand-100'
                            : 'text-coral-600 dark:text-coral-400',
                        )}
                      >
                        {movement.type === 'income' ? '+' : '-'}
                        {formatMoney(Number(movement.amount))}
                      </p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => editMovement(movement)}
                          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label="Editar movimiento"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(movement)}
                          className="rounded-lg p-2 text-coral-600 hover:bg-coral-50 dark:text-coral-400 dark:hover:bg-coral-500/10"
                          aria-label="Eliminar movimiento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-line text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Movimiento</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3">Cuenta</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Metodo</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line dark:divide-slate-800">
                    {movements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="h-9 w-9 rounded-lg"
                              style={{ backgroundColor: movement.category?.color ?? '#64748b' }}
                            />
                            <div>
                              <p className="font-medium text-ink dark:text-white">
                                {movement.description || 'Movimiento'}
                              </p>
                              <p className="text-xs text-muted dark:text-slate-400">
                                {movementTypeLabel(movement.type)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {movement.category?.name ?? 'Sin categoria'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {movement.account?.name ?? 'Sin cuenta'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(movement.date)}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {paymentMethodLabel(movement.payment_method)}
                        </td>
                        <td
                          className={clsx(
                            'px-4 py-3 text-right font-semibold',
                            movement.type === 'income'
                              ? 'text-brand-700 dark:text-brand-100'
                              : 'text-coral-600 dark:text-coral-400',
                          )}
                        >
                          {movement.type === 'income' ? '+' : '-'}
                          {formatMoney(Number(movement.amount))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => editMovement(movement)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              aria-label="Editar movimiento"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(movement)}
                              className="rounded-lg p-2 text-coral-600 hover:bg-coral-50 dark:text-coral-400 dark:hover:bg-coral-500/10"
                              aria-label="Eliminar movimiento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-5">
              <EmptyState title="No hay movimientos" detail="Agrega tu primer ingreso o gasto para verlos aqui." />
            </div>
          )}
        </div>
      </section>
      </div>
    </>
  )
}
