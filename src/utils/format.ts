import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { AccountType, DebtPaymentFrequency, DebtStatus, DebtType, MovementType, PaymentMethod } from '../types/finance'
import { formatCurrencyAmount } from './currency'

export function formatMoney(value: number) {
  return formatCurrencyAmount(value)
}

export function formatDate(value: string) {
  return format(parseISO(value), 'dd MMM yyyy', { locale: es })
}

export function currentMonthValue() {
  return format(new Date(), 'yyyy-MM')
}

export function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(year, monthNumber - 1, 1)
  const end = new Date(year, monthNumber, 0)
  return {
    from: format(start, 'yyyy-MM-dd'),
    to: format(end, 'yyyy-MM-dd'),
  }
}

export function movementTypeLabel(type: MovementType | 'all') {
  const labels = {
    all: 'Todos',
    income: 'Ingreso',
    expense: 'Gasto',
  }
  return labels[type]
}

export function paymentMethodLabel(method: PaymentMethod) {
  const labels = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    other: 'Otro',
  }
  return labels[method]
}

export function accountTypeLabel(type: AccountType) {
  const labels = {
    cash: 'Efectivo',
    bank: 'Cuenta bancaria',
    debit_card: 'Tarjeta de debito',
    credit_card: 'Tarjeta de credito',
    savings: 'Ahorros',
    other: 'Otro',
  }
  return labels[type]
}

export function debtTypeLabel(type: DebtType) {
  const labels = {
    loan: 'Prestamo',
    credit_card: 'Tarjeta de credito',
    family: 'Familiar',
    store: 'Tienda',
    other: 'Otro',
  }
  return labels[type]
}

export function debtFrequencyLabel(frequency: DebtPaymentFrequency) {
  const labels = {
    once: 'Unica',
    weekly: 'Semanal',
    biweekly: 'Quincenal',
    monthly: 'Mensual',
  }
  return labels[frequency]
}

export function debtStatusLabel(status: DebtStatus) {
  const labels = {
    active: 'Activa',
    paid: 'Pagada',
    overdue: 'Vencida',
  }
  return labels[status]
}
