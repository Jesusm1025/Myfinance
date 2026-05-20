import type { Movement, MovementFilters, MovementFormValues, TransactionRow } from '../types/finance'
import { notifyMovementsChanged } from '../events/financeEvents'
import { monthRange } from '../utils/format'
import { requireSupabase } from './supabaseClient'

function mapTransaction(transaction: TransactionRow): Movement {
  return {
    ...transaction,
    date: transaction.transaction_date,
  }
}

function isAccountSchemaError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('account') || message.includes('relationship')
}

export async function listMovements(userId: string, filters: MovementFilters) {
  const client = requireSupabase()
  const range = monthRange(filters.month)
  const applyFilters = (query: ReturnType<typeof client.from> extends { select: (...args: never[]) => infer Query } ? Query : never) => {
    let nextQuery = query
      .eq('user_id', userId)
      .gte('transaction_date', filters.from || range.from)
      .lte('transaction_date', filters.to || range.to)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters.type !== 'all') nextQuery = nextQuery.eq('type', filters.type)
    if (filters.categoryId) nextQuery = nextQuery.eq('category_id', filters.categoryId)
    if (filters.accountId) nextQuery = nextQuery.eq('account_id', filters.accountId)
    if (filters.paymentMethod !== 'all') nextQuery = nextQuery.eq('payment_method', filters.paymentMethod)
    return nextQuery
  }

  const query = applyFilters(
    client
      .from('transactions')
      .select('*, category:categories(id, name, color), account:accounts(id, name, color)'),
  )

  const { data, error } = await query
  if (error && isAccountSchemaError(error) && !filters.accountId) {
    const fallbackQuery = applyFilters(
      client
        .from('transactions')
        .select('*, category:categories(id, name, color)'),
    )
    const { data: fallbackData, error: fallbackError } = await fallbackQuery
    if (fallbackError) throw fallbackError
    return ((fallbackData ?? []) as TransactionRow[]).map(mapTransaction)
  }
  if (error) throw error
  return ((data ?? []) as TransactionRow[]).map(mapTransaction)
}

export async function listAllMovements(userId: string) {
  const client = requireSupabase()
  const query = client
    .from('transactions')
    .select('*, category:categories(id, name, color), account:accounts(id, name, color)')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  const { data, error } = await query
  if (error && isAccountSchemaError(error)) {
    const { data: fallbackData, error: fallbackError } = await client
      .from('transactions')
      .select('*, category:categories(id, name, color)')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (fallbackError) throw fallbackError
    return ((fallbackData ?? []) as TransactionRow[]).map(mapTransaction)
  }
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
  if (!values.account_id) {
    throw new Error('La cuenta es obligatoria.')
  }
  if (!values.date) {
    throw new Error('La fecha es obligatoria.')
  }

  const payload = {
    user_id: userId,
    type: values.type,
    amount,
    category_id: values.category_id,
    account_id: values.account_id,
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
