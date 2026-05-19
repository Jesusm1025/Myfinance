import { supabase } from '../lib/supabase'
import type {
  Account,
  AccountFormValues,
  AccountTransfer,
  Category,
  CategoryFormValues,
  BudgetFormValues,
  Debt,
  DebtFormValues,
  Movement,
  MovementFilters,
  MovementFormValues,
  MonthlyBudget,
  TransferFormValues,
  TransactionRow,
} from '../types/finance'
import {
  notifyAccountsChanged,
  notifyBudgetsChanged,
  notifyCategoriesChanged,
  notifyDebtsChanged,
  notifyMovementsChanged,
} from '../events/financeEvents'
import type { CurrencyCode } from '../utils/currency'
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

const defaultAccounts: Array<Pick<Account, 'name' | 'type' | 'color' | 'initial_balance'>> = [
  { name: 'Efectivo', type: 'cash', color: '#198c7c', initial_balance: 0 },
  { name: 'Cuenta bancaria', type: 'bank', color: '#2563eb', initial_balance: 0 },
  { name: 'Tarjeta de debito', type: 'debit_card', color: '#0f766e', initial_balance: 0 },
  { name: 'Tarjeta de credito', type: 'credit_card', color: '#ee6c4d', initial_balance: 0 },
  { name: 'Ahorros', type: 'savings', color: '#d99f18', initial_balance: 0 },
  { name: 'Otro', type: 'other', color: '#64748b', initial_balance: 0 },
]

function requireSupabase() {
  if (!supabase) {
    throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

function isPreferencesSchemaError(error: { message?: string; details?: string } | null) {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase()
  return message.includes('user_preferences') || message.includes('schema cache') || message.includes('does not exist')
}

export async function getUserCurrencyPreference(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_preferences')
    .select('currency')
    .eq('user_id', userId)
    .maybeSingle()

  if (error && isPreferencesSchemaError(error)) return null
  if (error) throw error
  return data?.currency as CurrencyCode | null | undefined
}

export async function saveUserCurrencyPreference(userId: string, currency: CurrencyCode) {
  const client = requireSupabase()
  const { error } = await client.from('user_preferences').upsert(
    {
      user_id: userId,
      currency,
    },
    { onConflict: 'user_id' },
  )

  if (error && isPreferencesSchemaError(error)) return
  if (error) throw error
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

  const payload = {
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

export async function listDebts(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('debts')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Debt[]
}

export async function saveDebt(userId: string, values: DebtFormValues) {
  const client = requireSupabase()
  const initialAmount = Number(values.initial_amount)
  const outstandingBalance = Number(values.outstanding_balance)
  const interestRate = values.interest_rate.trim() ? Number(values.interest_rate) : null
  const minimumPayment = values.minimum_payment.trim() ? Number(values.minimum_payment) : null

  if (!values.name.trim()) {
    throw new Error('El nombre de la deuda es obligatorio.')
  }
  if (!values.creditor.trim()) {
    throw new Error('La persona o entidad acreedora es obligatoria.')
  }
  if (!Number.isFinite(initialAmount) || initialAmount <= 0) {
    throw new Error('El monto inicial debe ser mayor que 0.')
  }
  if (!Number.isFinite(outstandingBalance) || outstandingBalance < 0) {
    throw new Error('El saldo pendiente debe ser un numero valido.')
  }
  if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0)) {
    throw new Error('La tasa de interes debe ser un numero valido.')
  }
  if (minimumPayment !== null && (!Number.isFinite(minimumPayment) || minimumPayment < 0)) {
    throw new Error('El pago minimo debe ser un numero valido.')
  }
  if (!values.start_date) {
    throw new Error('La fecha de inicio es obligatoria.')
  }

  const payload = {
    user_id: userId,
    name: values.name.trim(),
    type: values.type,
    creditor: values.creditor.trim(),
    initial_amount: initialAmount,
    outstanding_balance: outstandingBalance,
    start_date: values.start_date,
    due_date: values.due_date || null,
    interest_rate: interestRate,
    minimum_payment: minimumPayment,
    payment_frequency: values.payment_frequency,
    status: values.status,
    notes: values.notes.trim() || null,
  }

  const query = values.id
    ? client.from('debts').update(payload).eq('id', values.id).eq('user_id', userId)
    : client.from('debts').insert(payload)

  const { error } = await query
  if (error) throw error
  notifyDebtsChanged()
}

export async function deleteDebt(userId: string, id: string) {
  const client = requireSupabase()
  const { error } = await client.from('debts').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  notifyDebtsChanged()
}
