import type {
  Category,
  Debt,
  DebtFormValues,
  DebtInstallment,
  DebtPayment,
  DebtPaymentFormValues,
  DebtSubaccount,
} from '../types/finance'
import { notifyCategoriesChanged, notifyDebtsChanged, notifyMovementsChanged } from '../events/financeEvents'
import { assertUserAccount } from './accountsService'
import { isSchemaMissingError, parseOptionalFinanceNumber, requireSupabase } from './supabaseClient'

function isDebtAdvancedSchemaError(error: { message?: string; details?: string; code?: string } | null) {
  return isSchemaMissingError(error, [
    'debt_subaccounts',
    'debt_installments',
    'balance_dop',
    'balance_usd',
    'minimum_payment_dop',
    'minimum_payment_usd',
    'credit_limit_dop',
    'credit_limit_usd',
    'usd_to_dop_rate',
    'credit_card_status',
    'schema cache',
    'does not exist',
  ])
}

async function ensureDebtPaymentCategory(userId: string) {
  const client = requireSupabase()
  const { data: existingCategories, error: selectError } = await client
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)
    .eq('type', 'expense')

  if (selectError) throw selectError

  const categories = (existingCategories ?? []) as Pick<Category, 'id' | 'name'>[]
  const exactCategory = categories.find((category) => category.name.toLowerCase() === 'pago de deuda')
  if (exactCategory) return exactCategory.id

  const equivalentCategory = categories.find((category) => category.name.toLowerCase() === 'deudas')
  if (equivalentCategory) return equivalentCategory.id

  const { data, error } = await client
    .from('categories')
    .upsert(
      {
        user_id: userId,
        name: 'Pago de deuda',
        type: 'expense',
        color: '#475569',
        icon: 'credit-card',
      },
      { onConflict: 'user_id,name,type' },
    )
    .select('id')
    .single()

  if (error) throw error
  notifyCategoriesChanged()
  return data.id as string
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

export async function listDebtSubaccounts(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('debt_subaccounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as DebtSubaccount[]
}

export async function listDebtInstallments(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('debt_installments')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error && isDebtAdvancedSchemaError(error)) return [] as DebtInstallment[]
  if (error) throw error
  return data as DebtInstallment[]
}

export async function saveDebt(userId: string, values: DebtFormValues) {
  const client = requireSupabase()
  const initialAmount = Number(values.initial_amount)
  const outstandingBalance = Number(values.outstanding_balance)
  const interestRate = values.interest_rate.trim() ? Number(values.interest_rate) : null
  const minimumPayment = values.minimum_payment.trim() ? Number(values.minimum_payment) : null
  const creditLimit = parseOptionalFinanceNumber(values.credit_limit, 'El limite de credito')
  const usedBalance = parseOptionalFinanceNumber(values.used_balance, 'El balance usado')
  const statementBalance = parseOptionalFinanceNumber(values.statement_balance, 'El pendiente del ultimo corte')
  const balanceDop = parseOptionalFinanceNumber(values.balance_dop, 'El balance DOP')
  const balanceUsd = parseOptionalFinanceNumber(values.balance_usd, 'El balance USD')
  const minimumPaymentDop = parseOptionalFinanceNumber(values.minimum_payment_dop, 'El pago minimo DOP')
  const minimumPaymentUsd = parseOptionalFinanceNumber(values.minimum_payment_usd, 'El pago minimo USD')
  const creditLimitDop = parseOptionalFinanceNumber(values.credit_limit_dop, 'El limite DOP')
  const creditLimitUsd = parseOptionalFinanceNumber(values.credit_limit_usd, 'El limite USD')
  const usdToDopRate = values.usd_to_dop_rate.trim() ? Number(values.usd_to_dop_rate) : null

  if (!values.name.trim()) {
    throw new Error('El nombre de la deuda es obligatorio.')
  }
  if (!values.creditor.trim()) {
    throw new Error('La persona o entidad acreedora es obligatoria.')
  }
  if (!Number.isFinite(initialAmount) || initialAmount < 0) {
    throw new Error('El monto inicial debe ser mayor o igual a 0.')
  }
  if (!Number.isFinite(outstandingBalance) || outstandingBalance < 0) {
    throw new Error('El saldo pendiente debe ser un numero valido.')
  }
  if (outstandingBalance > initialAmount) {
    throw new Error('El saldo pendiente no puede ser mayor que el monto inicial.')
  }
  if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0)) {
    throw new Error('La tasa de interes debe ser un numero valido.')
  }
  if (minimumPayment !== null && (!Number.isFinite(minimumPayment) || minimumPayment < 0)) {
    throw new Error('El pago minimo debe ser un numero valido.')
  }
  if (values.type === 'credit_card') {
    if (values.card_last4 && !/^[0-9]{4}$/.test(values.card_last4.trim())) {
      throw new Error('Los ultimos 4 digitos deben tener exactamente 4 numeros.')
    }
    if (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit < 0)) {
      throw new Error('El limite de credito debe ser un numero valido.')
    }
    if (usedBalance !== null && (!Number.isFinite(usedBalance) || usedBalance < 0)) {
      throw new Error('El balance usado debe ser un numero valido.')
    }
    if (statementBalance !== null && (!Number.isFinite(statementBalance) || statementBalance < 0)) {
      throw new Error('El pendiente del ultimo corte debe ser un numero valido.')
    }
    if (usdToDopRate !== null && (!Number.isFinite(usdToDopRate) || usdToDopRate <= 0)) {
      throw new Error('La tasa USD a DOP debe ser mayor que 0.')
    }
  }
  if (!values.start_date) {
    throw new Error('La fecha de inicio es obligatoria.')
  }

  const subaccountRows = values.type === 'credit_card'
    ? values.subaccounts
        .map((subaccount) => ({
          user_id: userId,
          debt_id: '',
          name: subaccount.name.trim(),
          balance: subaccount.balance.trim() ? Number(subaccount.balance) : 0,
          credit_limit: subaccount.credit_limit.trim() ? Number(subaccount.credit_limit) : 0,
        }))
        .filter((subaccount) => subaccount.name || subaccount.balance > 0 || subaccount.credit_limit > 0)
    : []

  subaccountRows.forEach((subaccount) => {
    if (!subaccount.name) {
      throw new Error('Cada subcuenta debe tener un nombre.')
    }
    if (!Number.isFinite(subaccount.balance) || subaccount.balance < 0) {
      throw new Error(`El balance de ${subaccount.name} debe ser mayor o igual a 0.`)
    }
    if (!Number.isFinite(subaccount.credit_limit) || subaccount.credit_limit < 0) {
      throw new Error(`El limite de ${subaccount.name} debe ser mayor o igual a 0.`)
    }
  })

  const payload = {
    user_id: userId,
    name: values.name.trim(),
    type: values.type,
    creditor: values.creditor.trim(),
    currency: values.currency,
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

  const creditCardPayload: Record<string, unknown> = values.type === 'credit_card'
    ? {
        card_last4: values.card_last4.trim() || null,
        credit_limit: creditLimit,
        used_balance: usedBalance,
        statement_balance: statementBalance,
        balance_dop: balanceDop,
        balance_usd: balanceUsd,
        minimum_payment_dop: minimumPaymentDop,
        minimum_payment_usd: minimumPaymentUsd,
        credit_limit_dop: creditLimitDop,
        credit_limit_usd: creditLimitUsd,
        usd_to_dop_rate: usdToDopRate,
        statement_date: values.statement_date || null,
        credit_card_status: values.credit_card_status || null,
      }
    : {}

  const debtPayload: Record<string, unknown> = { ...payload, ...creditCardPayload }

  const query = values.id
    ? client.from('debts').update(debtPayload).eq('id', values.id).eq('user_id', userId).select('id').single()
    : client.from('debts').insert(debtPayload).select('id').single()

  const { data, error } = await query
  if (error) {
    if (values.type === 'credit_card' && isDebtAdvancedSchemaError(error)) {
      throw new Error('Falta ejecutar el SQL actualizado de deudas en Supabase para guardar tarjetas avanzadas.')
    }
    throw error
  }

  const debtId = data.id as string
  if (values.type === 'credit_card') {
    const { error: deleteSubaccountsError } = await client
      .from('debt_subaccounts')
      .delete()
      .eq('debt_id', debtId)
      .eq('user_id', userId)
    if (deleteSubaccountsError) {
      if (isDebtAdvancedSchemaError(deleteSubaccountsError)) {
        throw new Error('Falta crear la tabla debt_subaccounts. Ejecuta el SQL actualizado de deudas en Supabase.')
      }
      throw deleteSubaccountsError
    }

    if (subaccountRows.length) {
      const { error: insertSubaccountsError } = await client.from('debt_subaccounts').insert(
        subaccountRows.map((subaccount) => ({ ...subaccount, debt_id: debtId })),
      )
      if (insertSubaccountsError) {
        if (isDebtAdvancedSchemaError(insertSubaccountsError)) {
          throw new Error('Falta crear la tabla debt_subaccounts. Ejecuta el SQL actualizado de deudas en Supabase.')
        }
        throw insertSubaccountsError
      }
    }
  } else if (values.id) {
    const { error: deleteSubaccountsError } = await client
      .from('debt_subaccounts')
      .delete()
      .eq('debt_id', values.id)
      .eq('user_id', userId)
    if (deleteSubaccountsError && !isDebtAdvancedSchemaError(deleteSubaccountsError)) throw deleteSubaccountsError
  }

  notifyDebtsChanged()
}

export async function payDebtInstallment(userId: string, installmentId: string) {
  if (!userId) {
    throw new Error('Debes iniciar sesion para pagar cuotas.')
  }
  if (!installmentId) {
    throw new Error('Selecciona una cuota valida.')
  }

  const client = requireSupabase()
  const { error } = await client.rpc('pay_debt_installment', {
    p_installment_id: installmentId,
    p_payment_date: new Date().toISOString().slice(0, 10),
    p_payment_method: null,
    p_note: 'Pago de cuota',
  })
  if (error) {
    if (isDebtAdvancedSchemaError(error)) {
      throw new Error('Falta ejecutar el SQL actualizado de cuotas de deudas en Supabase.')
    }
    throw error
  }
  notifyDebtsChanged()
}

export async function deleteDebt(userId: string, id: string) {
  const client = requireSupabase()
  const { error } = await client.from('debts').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  notifyDebtsChanged()
}

export async function listDebtPayments(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('debt_payments')
    .select('*')
    .eq('user_id', userId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as DebtPayment[]
}

export async function registerDebtPayment(userId: string, values: DebtPaymentFormValues) {
  const client = requireSupabase()
  const amount = Number(values.amount)

  if (!userId) {
    throw new Error('Debes iniciar sesion para registrar pagos.')
  }
  if (!values.debt_id) {
    throw new Error('Selecciona una deuda valida.')
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El pago debe ser mayor que 0.')
  }
  if (!values.payment_date) {
    throw new Error('La fecha del pago es obligatoria.')
  }
  let categoryId: string | null = null
  if (values.create_movement) {
    if (!values.account_id) {
      throw new Error('Selecciona la cuenta para crear el movimiento de gasto.')
    }
    await assertUserAccount(userId, values.account_id)
    categoryId = await ensureDebtPaymentCategory(userId)
  }

  const { error } = await client.rpc('register_debt_payment', {
    p_debt_id: values.debt_id,
    p_amount: amount,
    p_payment_date: values.payment_date,
    p_payment_method: values.payment_method || null,
    p_note: values.note.trim() || null,
    p_create_movement: values.create_movement,
    p_category_id: categoryId,
    p_account_id: values.create_movement ? values.account_id : null,
  })

  if (error) throw error
  notifyDebtsChanged()
  if (values.create_movement) notifyMovementsChanged()
}
