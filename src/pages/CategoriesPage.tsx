import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Briefcase,
  Bus,
  CircleEllipsis,
  CreditCard,
  Edit2,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  LoaderCircle,
  Plus,
  Save,
  Shirt,
  Store,
  Trash2,
  Utensils,
  X,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'
import { StatusMessage } from '../components/StatusMessage'
import { categoriesChangedEvent } from '../events/financeEvents'
import {
  countCategoryMovements,
  deleteCategory,
  ensureDefaultCategories,
  listCategories,
  saveCategory,
} from '../services/accounting'
import type { Category, CategoryFormValues } from '../types/finance'
import { movementTypeLabel } from '../utils/format'
import { scrollToElement } from '../utils/scroll'

type IconName =
  | 'utensils'
  | 'bus'
  | 'home'
  | 'zap'
  | 'heart-pulse'
  | 'graduation-cap'
  | 'film'
  | 'shirt'
  | 'credit-card'
  | 'circle-ellipsis'
  | 'briefcase'
  | 'laptop'
  | 'store'
  | 'gift'

const iconComponents: Record<IconName, LucideIcon> = {
  utensils: Utensils,
  bus: Bus,
  home: Home,
  zap: Zap,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  film: Film,
  shirt: Shirt,
  'credit-card': CreditCard,
  'circle-ellipsis': CircleEllipsis,
  briefcase: Briefcase,
  laptop: Laptop,
  store: Store,
  gift: Gift,
}

const iconOptions: Array<{ value: IconName; label: string }> = [
  { value: 'utensils', label: 'Comida' },
  { value: 'bus', label: 'Transporte' },
  { value: 'home', label: 'Vivienda' },
  { value: 'zap', label: 'Servicios' },
  { value: 'heart-pulse', label: 'Salud' },
  { value: 'graduation-cap', label: 'Educacion' },
  { value: 'film', label: 'Entretenimiento' },
  { value: 'shirt', label: 'Ropa' },
  { value: 'credit-card', label: 'Deudas' },
  { value: 'briefcase', label: 'Trabajo' },
  { value: 'laptop', label: 'Freelance' },
  { value: 'store', label: 'Negocio' },
  { value: 'gift', label: 'Regalo' },
  { value: 'circle-ellipsis', label: 'Otros' },
]

const initialValues: CategoryFormValues = {
  name: '',
  type: 'expense',
  color: '#198c7c',
  icon: 'circle-ellipsis',
}

const swatches = ['#198c7c', '#ee6c4d', '#d99f18', '#2563eb', '#7c3aed', '#0f766e', '#db2777', '#64748b']

function getIcon(icon?: string | null) {
  return iconComponents[(icon as IconName) || 'circle-ellipsis'] ?? CircleEllipsis
}

export function CategoriesPage() {
  const { user } = useAuth()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [categories, setCategories] = useState<Category[]>([])
  const [values, setValues] = useState<CategoryFormValues>(initialValues)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const formRef = useRef<HTMLElement | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      await ensureDefaultCategories(user.id, user.email)
      setCategories(await listCategories(user.id))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las categorias.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    window.addEventListener(categoriesChangedEvent, refresh)
    return () => window.removeEventListener(categoriesChangedEvent, refresh)
  }, [refresh])

  const groupedCategories = useMemo(
    () => ({
      expense: categories.filter((category) => category.type === 'expense'),
      income: categories.filter((category) => category.type === 'income'),
    }),
    [categories],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await saveCategory(user.id, values)
      setValues(initialValues)
      setSuccess(values.id ? 'Categoria actualizada correctamente.' : 'Categoria creada correctamente.')
      await refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la categoria.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(category: Category) {
    if (!user) return
    setError('')
    setSuccess('')

    try {
      const movementCount = await countCategoryMovements(user.id, category.id)
      const message =
        movementCount > 0
          ? `La categoria "${category.name}" tiene ${movementCount} movimiento(s) asociados. Si la eliminas, esos movimientos quedaran sin categoria, pero no se borraran. Deseas continuar?`
          : `Eliminar categoria "${category.name}"?`

      const confirmed = await confirm({
        title: movementCount > 0 ? 'Eliminar categoria en uso' : 'Eliminar categoria',
        description: message,
        confirmLabel: 'Eliminar',
        variant: 'danger',
      })
      if (!confirmed) return

      await deleteCategory(user.id, category.id)
      setSuccess('Categoria eliminada correctamente.')
      await refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la categoria.')
    }
  }

  function startEdit(category: Category) {
    setValues({
      id: category.id,
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon ?? 'circle-ellipsis',
    })
    scrollToElement(formRef)
  }

  return (
    <>
      <ConfirmDialog />
      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
      <section ref={formRef} className="scroll-mt-24 rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              {values.id ? 'Editar categoria' : 'Nueva categoria'}
            </h2>
            <p className="text-sm text-muted dark:text-slate-400">Personaliza tipo, color e icono.</p>
          </div>
        </div>

        {error ? <div className="mt-4"><StatusMessage message={error} /></div> : null}
        {success ? <div className="mt-4"><StatusMessage message={success} variant="success" /></div> : null}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</span>
            <input
              required
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20"
              placeholder="Comida, salario, transporte"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</span>
            <select
              value={values.type}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  type: event.target.value as CategoryFormValues['type'],
                }))
              }
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20"
            >
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
          </label>

          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Color</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {swatches.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Color ${color}`}
                  onClick={() => setValues((current) => ({ ...current, color }))}
                  className={`h-9 w-9 rounded-lg border-2 ${
                    values.color === color ? 'border-ink dark:border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={values.color}
                onChange={(event) => setValues((current) => ({ ...current, color: event.target.value }))}
                className="h-9 w-12 rounded-lg border border-line bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
                aria-label="Color personalizado"
              />
            </div>
          </div>

          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Icono</span>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {iconOptions.map((option) => {
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={option.label}
                    onClick={() => setValues((current) => ({ ...current, icon: option.value }))}
                    className={clsx(
                      'grid h-11 place-items-center rounded-lg border transition',
                      values.icon === option.value
                        ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-100 dark:bg-brand-500/15 dark:text-brand-100'
                        : 'border-line text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                    )}
                    aria-label={`Icono ${option.label}`}
                  >
                    {createElement(iconComponents[option.value], { className: 'h-5 w-5' })}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-line p-3 dark:border-slate-800">
            <span className="grid h-11 w-11 place-items-center rounded-lg text-white" style={{ backgroundColor: values.color }}>
              {createElement(getIcon(values.icon), { className: 'h-5 w-5' })}
            </span>
            <div>
              <p className="font-semibold">{values.name || 'Vista previa'}</p>
              <p className="text-sm text-muted dark:text-slate-400">{movementTypeLabel(values.type)}</p>
            </div>
          </div>

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
                onClick={() => setValues(initialValues)}
                className="rounded-lg border border-line px-4 py-3 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Cancelar edicion"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">Categorias personalizadas</h2>
          <p className="text-sm text-muted dark:text-slate-400">
            Cada categoria pertenece al usuario autenticado y se usa para clasificar movimientos.
          </p>
        </div>

        {loading ? (
          <SkeletonList rows={4} itemHeight="h-24" />
        ) : categories.length ? (
          <div className="grid gap-5">
            {(['expense', 'income'] as const).map((type) => (
              <div key={type}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{type === 'expense' ? 'Gastos' : 'Ingresos'}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {groupedCategories[type].length}
                  </span>
                </div>
                {groupedCategories[type].length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {groupedCategories[type].map((category) => {
                      return (
                        <article key={category.id} className="rounded-lg border border-line p-4 dark:border-slate-800">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white"
                                style={{ backgroundColor: category.color }}
                              >
                                {createElement(getIcon(category.icon), { className: 'h-5 w-5' })}
                              </span>
                              <div className="min-w-0">
                                <h4 className="truncate font-semibold">{category.name}</h4>
                                <p className="text-sm text-muted dark:text-slate-400">{movementTypeLabel(category.type)}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(category)}
                                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                aria-label="Editar categoria"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(category)}
                                className="rounded-lg p-2 text-coral-600 hover:bg-coral-50 dark:text-coral-400 dark:hover:bg-coral-500/10"
                                aria-label="Eliminar categoria"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title={`Sin categorias de ${type === 'expense' ? 'gasto' : 'ingreso'}`}
                    detail="Crea una categoria para completar este grupo."
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Aun no hay categorias" detail="Crea tus categorias para empezar a clasificar movimientos." />
        )}
      </section>
      </div>
    </>
  )
}
