import { supabase } from '../lib/supabase'
import type {
  Category,
  CategoryFormValues,
  Movement,
  MovementFilters,
  MovementFormValues,
  TransactionRow,
} from '../types/finance'
import { notifyCategoriesChanged, notifyMovementsChanged } from '../events/financeEvents'
import { monthRange } from '../utils/format'

const defaultCategories: Array<Pick<Category, 'name' | 'type' | 'color'> & { icon: string }> = [
  { name: 'Comida', type: 'expense', color: '#ee6c4d', icon: 'utensils' },
  { name: 'Transporte', type: 'expense', color: '#2563eb', icon: 'bus' },
  { name: 'Vivienda', type: 'expense', color: '#198c7c', icon: 'home' },
  { name: 'Servicios', type: 'expense', color: '#d99f18', icon: 'zap' },
  { name: 'Salud', type: 'expense', color: '#dc5538', icon: 'heart-pulse' },
  { name: 'Educacion', type: 'expense', color: '#7c3aed', icon: 'graduation-cap' },
  { name: 'Entretenimiento', type: 'expense', color: '#0891b2', icon: 'film' },
  { name: 'Ropa', type: 'expense', color: '#db2777', icon: 'shirt' },
  { name: 'Deudas', type: 'expense', color: '#475569', icon: 'credit-card' },
  { name: 'Otros', type: 'expense', color: '#64748b', icon: 'circle-ellipsis' },
  { name: 'Salario', type: 'income', color: '#198c7c', icon: 'briefcase' },
  { name: 'Freelance', type: 'income', color: '#0f766e', icon: 'laptop' },
  { name: 'Negocio', type: 'income', color: '#2563eb', icon: 'store' },
  { name: 'Regalo', type: 'income', color: '#d99f18', icon: 'gift' },
  { name: 'Otros', type: 'income', color: '#64748b', icon: 'circle-ellipsis' },
]

function requireSupabase() {
  if (!supabase) {
    throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

export async function ensureDefaultCategories(userId: string, email?: string | null) {
  const client = requireSupabase()
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) throw profileError
  if (profile) return

  const { error: insertProfileError } = await client.from('profiles').upsert({
    id: userId,
    full_name: email ?? null,
  })
  if (insertProfileError) throw insertProfileError

  const { error: insertCategoriesError } = await client.from('categories').upsert(
    defaultCategories.map((category) => ({
      ...category,
      user_id: userId,
    })),
    { onConflict: 'user_id,name,type', ignoreDuplicates: true },
  )
  if (insertCategoriesError) throw insertCategoriesError
  notifyCategoriesChanged()
}

function mapTransaction(transaction: TransactionRow): Movement {
  return {
    ...transaction,
    date: transaction.transaction_date,
  }
}

export async function listCategories(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throw error
  return data as Category[]
}

export async function saveCategory(userId: string, values: CategoryFormValues) {
  const client = requireSupabase()
  const payload = {
    user_id: userId,
    name: values.name.trim(),
    type: values.type,
    color: values.color,
    icon: values.icon,
  }
  const query = values.id
    ? client.from('categories').update(payload).eq('id', values.id).eq('user_id', userId)
    : client.from('categories').insert(payload)
  const { error } = await query
  if (error) throw error
  notifyCategoriesChanged()
}

export async function countCategoryMovements(userId: string, categoryId: string) {
  const client = requireSupabase()
  const { count, error } = await client
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category_id', categoryId)

  if (error) throw error
  return count ?? 0
}

export async function deleteCategory(userId: string, id: string) {
  const client = requireSupabase()
  const { error } = await client.from('categories').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  notifyCategoriesChanged()
}

export async function listMovements(userId: string, filters: MovementFilters) {
  const client = requireSupabase()
  const range = monthRange(filters.month)
  let query = client
    .from('transactions')
    .select('*, category:categories(id, name, color)')
    .eq('user_id', userId)
    .gte('transaction_date', filters.from || range.from)
    .lte('transaction_date', filters.to || range.to)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.type !== 'all') query = query.eq('type', filters.type)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.paymentMethod !== 'all') query = query.eq('payment_method', filters.paymentMethod)

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as TransactionRow[]).map(mapTransaction)
}

export async function listAllMovements(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('transactions')
    .select('*, category:categories(id, name, color)')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as TransactionRow[]).map(mapTransaction)
}

export async function saveMovement(userId: string, values: MovementFormValues) {
  const client = requireSupabase()
  const amount = Number(values.amount)

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El monto debe ser mayor que 0.')
  }
  if (!values.category_id) {
    throw new Error('La categoria es obligatoria.')
  }
  if (!values.date) {
    throw new Error('La fecha es obligatoria.')
  }

  const payload = {
    user_id: userId,
    type: values.type,
    amount,
    category_id: values.category_id,
    description: values.description.trim() || null,
    transaction_date: values.date,
    payment_method: values.payment_method,
  }
  const query = values.id
    ? client.from('transactions').update(payload).eq('id', values.id).eq('user_id', userId)
    : client.from('transactions').insert(payload)
  const { error } = await query
  if (error) throw error
  notifyMovementsChanged()
}

export async function deleteMovement(userId: string, id: string) {
  const client = requireSupabase()
  const { error } = await client.from('transactions').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  notifyMovementsChanged()
}
