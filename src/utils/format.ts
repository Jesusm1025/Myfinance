import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { MovementType, PaymentMethod } from '../types/finance'

export const moneyFormatter = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  maximumFractionDigits: 2,
})

export function formatMoney(value: number) {
  return moneyFormatter.format(value)
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
