import type { SavingsGoal, SavingsGoalFormValues, SavingsGoalStatus } from '../types/finance'
import { notifySavingsGoalsChanged } from '../events/financeEvents'
import { isSchemaMissingError, parseOptionalFinanceNumber, requireSupabase } from './supabaseClient'

function isSavingsGoalsSchemaError(error: { message?: string; details?: string; code?: string } | null) {
  return isSchemaMissingError(error, ['savings_goals', 'schema cache', 'does not exist'])
}

export async function listSavingsGoals(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('savings_goals')
    .select('*, account:accounts(id, name, color)')
    .eq('user_id', userId)
    .order('status', { ascending: true })
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error && isSavingsGoalsSchemaError(error)) return [] as SavingsGoal[]
  if (error) throw error
  return (data ?? []) as SavingsGoal[]
}

export async function saveSavingsGoal(userId: string, values: SavingsGoalFormValues) {
  const client = requireSupabase()
  const targetAmount = Number(values.target_amount)
  const currentAmount = Number(values.current_amount)
  const monthlyTarget = parseOptionalFinanceNumber(values.monthly_target, 'La meta mensual', { allowZero: true })

  if (!values.name.trim()) {
    throw new Error('El nombre de la meta es obligatorio.')
  }
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    throw new Error('El monto objetivo debe ser mayor que 0.')
  }
  if (!Number.isFinite(currentAmount) || currentAmount < 0) {
    throw new Error('El monto actual debe ser mayor o igual a 0.')
  }
  if (currentAmount > targetAmount * 10) {
    throw new Error('El monto actual luce demasiado alto para esta meta.')
  }

  const payload = {
    user_id: userId,
    account_id: values.account_id || null,
    name: values.name.trim(),
    description: values.description.trim() || null,
    target_amount: targetAmount,
    current_amount: currentAmount,
    currency: values.currency,
    goal_type: values.goal_type,
    target_date: values.target_date || null,
    monthly_target: monthlyTarget,
    status: values.status,
    color: values.color,
    icon: values.icon.trim() || null,
  }

  const query = values.id
    ? client.from('savings_goals').update(payload).eq('id', values.id).eq('user_id', userId)
    : client.from('savings_goals').insert(payload)
  const { error } = await query
  if (error) {
    if (isSavingsGoalsSchemaError(error)) {
      throw new Error('Falta ejecutar el SQL de metas de ahorro en Supabase.')
    }
    throw error
  }
  notifySavingsGoalsChanged()
}

export async function updateSavingsGoalStatus(userId: string, id: string, status: SavingsGoalStatus) {
  const client = requireSupabase()
  const { error } = await client.from('savings_goals').update({ status }).eq('id', id).eq('user_id', userId)
  if (error) throw error
  notifySavingsGoalsChanged()
}

export async function deleteSavingsGoal(userId: string, id: string) {
  const client = requireSupabase()
  const { error } = await client.from('savings_goals').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  notifySavingsGoalsChanged()
}
