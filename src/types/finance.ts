export type MovementType = 'income' | 'expense'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'
export type AccountType = 'cash' | 'bank' | 'debit_card' | 'credit_card' | 'savings' | 'other'
export type DebtType = 'loan' | 'credit_card' | 'education' | 'family' | 'store' | 'other'
export type DebtPaymentFrequency = 'once' | 'weekly' | 'biweekly' | 'monthly'
export type DebtStatus = 'active' | 'paid' | 'overdue'
export type CreditCardDebtStatus = 'al_dia' | 'vencida' | 'mora' | 'sobregirada'
export type DebtInstallmentStatus = 'pending' | 'paid' | 'overdue'
export type DebtCurrencyCode = 'DOP' | 'USD' | 'EUR' | 'BOB'
export type SavingsGoalType = 'emergency_fund' | 'vehicle_down_payment' | 'travel' | 'purchase' | 'monthly_savings' | 'custom'
export type SavingsGoalStatus = 'active' | 'completed' | 'paused' | 'cancelled'

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
  debt_id?: string | null
  debt_payment_id?: string | null
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

export type Debt = {
  id: string
  user_id: string
  name: string
  type: DebtType
  creditor: string
  currency: DebtCurrencyCode
  initial_amount: number
  outstanding_balance: number
  start_date: string
  due_date: string | null
  interest_rate: number | null
  minimum_payment: number | null
  card_last4: string | null
  credit_limit: number | null
  used_balance: number | null
  statement_balance: number | null
  balance_dop: number | null
  balance_usd: number | null
  minimum_payment_dop: number | null
  minimum_payment_usd: number | null
  credit_limit_dop: number | null
  credit_limit_usd: number | null
  usd_to_dop_rate: number | null
  statement_date: string | null
  credit_card_status: CreditCardDebtStatus | null
  payment_frequency: DebtPaymentFrequency
  status: DebtStatus
  notes: string | null
  created_at: string
  updated_at?: string
}

export type DebtSubaccount = {
  id: string
  debt_id: string
  user_id: string
  name: string
  balance: number
  credit_limit: number
  available: number
  created_at: string
  updated_at?: string
}

export type DebtSubaccountFormValues = {
  id?: string
  name: string
  balance: string
  credit_limit: string
}

export type DebtPayment = {
  id: string
  debt_id: string
  user_id: string
  transaction_id?: string | null
  amount: number
  payment_date: string
  payment_method: PaymentMethod | null
  note: string | null
  created_at: string
}

export type DebtInstallment = {
  id: string
  debt_id: string
  user_id: string
  description: string
  amount: number
  due_date: string | null
  status: DebtInstallmentStatus
  paid_at: string | null
  debt_payment_id: string | null
  created_at: string
  updated_at?: string
}

export type DebtFormValues = {
  id?: string
  name: string
  type: DebtType
  creditor: string
  currency: DebtCurrencyCode
  initial_amount: string
  outstanding_balance: string
  start_date: string
  due_date: string
  interest_rate: string
  minimum_payment: string
  card_last4: string
  credit_limit: string
  used_balance: string
  statement_balance: string
  balance_dop: string
  balance_usd: string
  minimum_payment_dop: string
  minimum_payment_usd: string
  credit_limit_dop: string
  credit_limit_usd: string
  usd_to_dop_rate: string
  statement_date: string
  credit_card_status: CreditCardDebtStatus | ''
  subaccounts: DebtSubaccountFormValues[]
  payment_frequency: DebtPaymentFrequency
  status: DebtStatus
  notes: string
}

export type DebtPaymentFormValues = {
  debt_id: string
  amount: string
  payment_date: string
  payment_method: '' | PaymentMethod
  create_movement: boolean
  account_id: string
  note: string
}

export type SavingsGoal = {
  id: string
  user_id: string
  account_id: string | null
  name: string
  description: string | null
  target_amount: number
  current_amount: number
  currency: DebtCurrencyCode
  goal_type: SavingsGoalType
  target_date: string | null
  monthly_target: number | null
  status: SavingsGoalStatus
  color: string
  icon: string | null
  created_at: string
  updated_at?: string
  account?: Pick<Account, 'id' | 'name' | 'color'> | null
}

export type SavingsGoalContribution = {
  id: string
  user_id: string
  goal_id: string
  account_id: string | null
  transaction_id: string | null
  amount: number
  contribution_date: string
  note: string | null
  created_at: string
  updated_at?: string
  account?: Pick<Account, 'id' | 'name' | 'color'> | null
}

export type SavingsGoalFormValues = {
  id?: string
  account_id: string
  name: string
  description: string
  target_amount: string
  current_amount: string
  currency: DebtCurrencyCode
  goal_type: SavingsGoalType
  target_date: string
  monthly_target: string
  status: SavingsGoalStatus
  color: string
  icon: string
}

export type SavingsGoalContributionFormValues = {
  id?: string
  goal_id: string
  account_id: string
  amount: string
  contribution_date: string
  note: string
}
