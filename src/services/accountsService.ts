import type { Account, AccountFormValues, AccountTransfer, TransferFormValues } from '../types/finance'
import { notifyAccountsChanged } from '../events/financeEvents'
import { requireSupabase } from './supabaseClient'

export async function listAccounts(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throw error
  return data as Account[]
}

export async function saveAccount(userId: string, values: AccountFormValues) {
  const client = requireSupabase()
  const initialBalance = Number(values.initial_balance || 0)

  if (!values.name.trim()) {
    throw new Error('El nombre de la cuenta es obligatorio.')
  }
  if (!Number.isFinite(initialBalance)) {
    throw new Error('El balance inicial debe ser un numero valido.')
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    name: values.name.trim(),
    type: values.type,
    color: values.color,
    initial_balance: initialBalance,
  }
  const query = values.id
    ? client.from('accounts').update(payload).eq('id', values.id).eq('user_id', userId)
    : client.from('accounts').insert(payload)
  const { error } = await query
  if (error) throw error
  notifyAccountsChanged()
}

export async function countAccountUsage(userId: string, accountId: string) {
  const client = requireSupabase()
  const [transactions, outgoingTransfers, incomingTransfers] = await Promise.all([
    client
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('account_id', accountId),
    client
      .from('account_transfers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('from_account_id', accountId),
    client
      .from('account_transfers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('to_account_id', accountId),
  ])

  if (transactions.error) throw transactions.error
  if (outgoingTransfers.error) throw outgoingTransfers.error
  if (incomingTransfers.error) throw incomingTransfers.error

  return (transactions.count ?? 0) + (outgoingTransfers.count ?? 0) + (incomingTransfers.count ?? 0)
}

export async function deleteAccount(userId: string, id: string) {
  const usageCount = await countAccountUsage(userId, id)
  if (usageCount > 0) {
    throw new Error('No se puede eliminar una cuenta con movimientos o transferencias asociadas.')
  }

  const client = requireSupabase()
  const { error } = await client.from('accounts').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  notifyAccountsChanged()
}

export async function listAccountTransfers(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('account_transfers')
    .select('*, from_account:accounts!account_transfers_from_account_id_fkey(id, name, color), to_account:accounts!account_transfers_to_account_id_fkey(id, name, color)')
    .eq('user_id', userId)
    .order('transfer_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as AccountTransfer[]
}

export async function saveAccountTransfer(userId: string, values: TransferFormValues) {
  const client = requireSupabase()
  const amount = Number(values.amount)

  if (!values.from_account_id || !values.to_account_id) {
    throw new Error('Selecciona cuenta origen y cuenta destino.')
  }
  if (values.from_account_id === values.to_account_id) {
    throw new Error('La cuenta origen y destino deben ser diferentes.')
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El monto debe ser mayor que 0.')
  }
  if (!values.date) {
    throw new Error('La fecha es obligatoria.')
  }

  const payload = {
    user_id: userId,
    from_account_id: values.from_account_id,
    to_account_id: values.to_account_id,
    amount,
    description: values.description.trim() || null,
    transfer_date: values.date,
  }
  const query = values.id
    ? client.from('account_transfers').update(payload).eq('id', values.id).eq('user_id', userId)
    : client.from('account_transfers').insert(payload)
  const { error } = await query
  if (error) throw error
  notifyAccountsChanged()
}

export async function deleteAccountTransfer(userId: string, id: string) {
  const client = requireSupabase()
  const { error } = await client.from('account_transfers').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  notifyAccountsChanged()
}

export async function assertUserAccount(userId: string, accountId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error('Selecciona una cuenta valida para registrar el gasto.')
  }
}
