export type MovementType = 'income' | 'expense'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

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
  date: string
  payment_method: PaymentMethod
  created_at: string
  updated_at?: string
  category?: Pick<Category, 'id' | 'name' | 'color'> | null
}

export type TransactionRow = Omit<Movement, 'date' | 'category'> & {
  transaction_date: string
  category?: Pick<Category, 'id' | 'name' | 'color'> | null
}

export type MovementFormValues = {
  id?: string
  type: MovementType
  amount: string
  category_id: string
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

export type MovementFilters = {
  month: string
  type: 'all' | MovementType
  categoryId: string
  paymentMethod: 'all' | PaymentMethod
  from: string
  to: string
}
