import type { Account, Category } from '../types/finance'
import { notifyAccountsChanged, notifyCategoriesChanged } from '../events/financeEvents'
import { requireSupabase } from './supabaseClient'

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

const defaultAccounts: Array<Pick<Account, 'name' | 'type' | 'color' | 'initial_balance'>> = [
  { name: 'Efectivo', type: 'cash', color: '#198c7c', initial_balance: 0 },
  { name: 'Cuenta bancaria', type: 'bank', color: '#2563eb', initial_balance: 0 },
  { name: 'Tarjeta de debito', type: 'debit_card', color: '#0f766e', initial_balance: 0 },
  { name: 'Tarjeta de credito', type: 'credit_card', color: '#ee6c4d', initial_balance: 0 },
  { name: 'Ahorros', type: 'savings', color: '#d99f18', initial_balance: 0 },
  { name: 'Otro', type: 'other', color: '#64748b', initial_balance: 0 },
]

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

export async function ensureDefaultAccounts(userId: string) {
  const client = requireSupabase()
  const { count, error: countError } = await client
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (countError) throw countError
  if (count && count > 0) return

  const { error } = await client.from('accounts').upsert(
    defaultAccounts.map((account) => ({
      ...account,
      user_id: userId,
    })),
    { onConflict: 'user_id,name', ignoreDuplicates: true },
  )

  if (error) throw error
  notifyAccountsChanged()
}
