import type { Category, CategoryFormValues } from '../types/finance'
import { notifyCategoriesChanged } from '../events/financeEvents'
import { requireSupabase } from './supabaseClient'

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
