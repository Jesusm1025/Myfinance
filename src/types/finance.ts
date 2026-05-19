export type MovementType = 'income' | 'expense'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'
export type AccountType = 'cash' | 'bank' | 'debit_card' | 'credit_card' | 'savings' | 'other'

export type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  color: string
  initial_balance: number
  created_at: string
  updated_at?: string
}

export type AccountFormValues = {
  id?: string
  name: string
  type: AccountType
  color: string
  initial_balance: string
}

export type Category = {
  id: string
  user_id: string
  name: string
  type: MovementType
  color: string
  icon?: string | null
  created_at: string
}

export type Movement = {
  id: string
  user_id: string
  category_id: string | null
  type: MovementType
  amount: number
  description: string | null
  account_id: string | null
  date: string
  payment_method: PaymentMethod
  created_at: string
  updated_at?: string
  category?: Pick<Category, 'id' | 'name' | 'color'> | null
  account?: Pick<Account, 'id' | 'name' | 'color'> | null
}

export type TransactionRow = Omit<Movement, 'date' | 'category' | 'account'> & {
  transaction_date: string
  category?: Pick<Category, 'id' | 'name' | 'color'> | null
  account?: Pick<Account, 'id' | 'name' | 'color'> | null
}

export type MovementFormValues = {
  id?: string
  type: MovementType
  amount: string
  category_id: string
  account_id: string
  description: string
  date: string
  payment_method: PaymentMethod
}

export type CategoryFormValues = {
  id?: string
  name: string
  type: MovementType
  color: string
  icon: string
}

export type MonthlyBudget = {
  id: string
  user_id: string
  month: string
  category_id: string | null
  amount: number
  created_at: string
  updated_at?: string
}

export type BudgetFormValues = {
  id?: string
  month: string
  category_id: string | null
  amount: string
}

export type AccountTransfer = {
  id: string
  user_id: string
  from_account_id: string
  to_account_id: string
  amount: number
  description: string | null
  transfer_date: string
  created_at: string
  updated_at?: string
  from_account?: Pick<Account, 'id' | 'name' | 'color'> | null
  to_account?: Pick<Account, 'id' | 'name' | 'color'> | null
}

export type TransferFormValues = {
  id?: string
  from_account_id: string
  to_account_id: string
  amount: string
  description: string
  date: string
}

export type MovementFilters = {
  month: string
  type: 'all' | MovementType
  categoryId: string
  accountId: string
  paymentMethod: 'all' | PaymentMethod
  from: string
  to: string
}
