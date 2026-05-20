import { supabase } from '../lib/supabase'

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

export function parseOptionalFinanceNumber(value: string, fieldName: string, options: { allowZero?: boolean } = {}) {
  if (!value.trim()) return null
  const numericValue = Number(value)
  const minimum = options.allowZero === false ? Number.MIN_VALUE : 0
  if (!Number.isFinite(numericValue) || numericValue < minimum) {
    throw new Error(`${fieldName} debe ser un numero valido.`)
  }
  return numericValue
}

export function isSchemaMissingError(error: { message?: string; details?: string; code?: string } | null, markers: string[]) {
  const message = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.code ?? ''}`.toLowerCase()
  return markers.some((marker) => message.includes(marker.toLowerCase()))
}
