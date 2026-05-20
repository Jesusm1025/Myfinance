import type { SavingsGoal, SavingsGoalContribution, SavingsGoalContributionFormValues, SavingsGoalFormValues, SavingsGoalStatus } from '../types/finance'
import { notifyAccountsChanged, notifySavingsGoalsChanged } from '../events/financeEvents'
import { isSchemaMissingError, parseOptionalFinanceNumber, requireSupabase } from './supabaseClient'

function isSavingsGoalsSchemaError(error: { message?: string; details?: string; code?: string } | null) {
  return isSchemaMissingError(error, [
    'savings_goals',
    'savings_goal_contributions',
    'register_savings_goal_contribution',
    'update_savings_goal_contribution',
    'delete_savings_goal_contribution',
    'source_account_id',
    'destination_account_id',
    'transfer_id',
    'contribution_mode',
    'schema cache',
    'does not exist',
  ])
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
  notifyAccountsChanged()
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

export async function listSavingsGoalContributions(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('savings_goal_contributions')
    .select('*, account:accounts(id, name, color), source_account:accounts!savings_goal_contributions_source_account_id_fkey(id, name, color), destination_account:accounts!savings_goal_contributions_destination_account_id_fkey(id, name, color)')
    .eq('user_id', userId)
    .order('contribution_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error && isSavingsGoalsSchemaError(error)) return [] as SavingsGoalContribution[]
  if (error) throw error
  return (data ?? []) as SavingsGoalContribution[]
}

async function assertContributionGoal(userId: string, goalId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('savings_goals')
    .select('id, status, target_amount, current_amount')
    .eq('id', goalId)
    .eq('user_id', userId)
    .single()

  if (error) throw error
  if (data.status === 'cancelled') {
    throw new Error('No puedes registrar aportes en una meta cancelada.')
  }

  return data as Pick<SavingsGoal, 'id' | 'status' | 'target_amount' | 'current_amount'>
}

export async function saveSavingsGoalContribution(userId: string, values: SavingsGoalContributionFormValues) {
  const client = requireSupabase()
  const amount = Number(values.amount)

  if (!values.goal_id) {
    throw new Error('Selecciona una meta valida.')
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El aporte debe ser mayor que 0.')
  }
  if (!values.contribution_date) {
    throw new Error('La fecha del aporte es obligatoria.')
  }
  if (values.contribution_mode === 'transfer') {
    if (!values.source_account_id || !values.destination_account_id) {
      throw new Error('Selecciona cuenta origen y destino para la transferencia.')
    }
    if (values.source_account_id === values.destination_account_id) {
      throw new Error('La cuenta origen y destino deben ser diferentes.')
    }
  }

  await assertContributionGoal(userId, values.goal_id)

  const payload = {
    p_goal_id: values.goal_id,
    p_account_id: values.account_id || null,
    p_source_account_id: values.contribution_mode === 'transfer' ? values.source_account_id : null,
    p_destination_account_id: values.contribution_mode === 'transfer' ? values.destination_account_id : null,
    p_contribution_mode: values.contribution_mode,
    p_amount: amount,
    p_contribution_date: values.contribution_date,
    p_note: values.note.trim() || null,
  }

  const { error } = values.id
    ? await client.rpc('update_savings_goal_contribution', {
        p_contribution_id: values.id,
        ...payload,
      })
    : await client.rpc('register_savings_goal_contribution', payload)

  if (error) {
    if (isSavingsGoalsSchemaError(error)) {
      throw new Error('Falta ejecutar el SQL actualizado de aportes a metas de ahorro en Supabase.')
    }
    throw error
  }
  notifySavingsGoalsChanged()
}

export async function deleteSavingsGoalContribution(userId: string, id: string, deleteTransfer = false) {
  if (!userId) {
    throw new Error('Debes iniciar sesion para eliminar aportes.')
  }
  const client = requireSupabase()
  const { error } = await client.rpc('delete_savings_goal_contribution', {
    p_contribution_id: id,
    p_delete_transfer: deleteTransfer,
  })
  if (error) throw error
  notifySavingsGoalsChanged()
  if (deleteTransfer) notifyAccountsChanged()
}
