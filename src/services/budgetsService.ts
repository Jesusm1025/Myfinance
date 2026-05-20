import type { BudgetFormValues, MonthlyBudget } from '../types/finance'
import { notifyBudgetsChanged } from '../events/financeEvents'
import { requireSupabase } from './supabaseClient'

export async function listMonthlyBudgets(userId: string, month: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('monthly_budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .order('category_id', { ascending: true, nullsFirst: true })

  if (error) throw error
  return data as MonthlyBudget[]
}

export async function saveMonthlyBudget(userId: string, values: BudgetFormValues) {
  const client = requireSupabase()
  const amount = Number(values.amount)

  if (!values.month) {
    throw new Error('El mes es obligatorio.')
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El presupuesto debe ser mayor que 0.')
  }

  const payload = {
    user_id: userId,
    month: values.month,
    category_id: values.category_id,
    amount,
  }

  const { error } = values.id
    ? await client.from('monthly_budgets').update(payload).eq('id', values.id).eq('user_id', userId)
    : await client.from('monthly_budgets').insert(payload)

  if (error) throw error
  notifyBudgetsChanged()
}

export async function deleteMonthlyBudget(userId: string, id: string) {
  const client = requireSupabase()
  const { error } = await client.from('monthly_budgets').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  notifyBudgetsChanged()
}
