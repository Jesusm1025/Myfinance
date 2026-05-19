export type CurrencyCode = 'DOP' | 'USD' | 'EUR' | 'BOB'

export type CurrencyOption = {
  code: CurrencyCode
  symbol: string
  prefix: string
  label: string
  locale: string
}

export const defaultCurrency: CurrencyCode = 'DOP'

export const currencyOptions: CurrencyOption[] = [
  { code: 'DOP', symbol: 'RD$', prefix: 'RD$', label: 'Peso dominicano', locale: 'es-DO' },
  { code: 'USD', symbol: 'US$', prefix: 'US$', label: 'Dolar estadounidense', locale: 'en-US' },
  { code: 'EUR', symbol: '€', prefix: '€', label: 'Euro', locale: 'es-ES' },
  { code: 'BOB', symbol: 'Bs', prefix: 'Bs ', label: 'Bolivar', locale: 'es-BO' },
]

let activeCurrency: CurrencyCode = defaultCurrency

function storageAvailable() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function globalStorageKey() {
  return 'finance:currency'
}

function userStorageKey(userId: string) {
  return `finance:currency:${userId}`
}

export function normalizeCurrencyCode(value: string | null | undefined): CurrencyCode {
  return currencyOptions.some((option) => option.code === value) ? (value as CurrencyCode) : defaultCurrency
}

export function getCurrencyOption(code: CurrencyCode = activeCurrency) {
  return currencyOptions.find((option) => option.code === code) ?? currencyOptions[0]
}

export function readStoredCurrency(userId?: string | null): CurrencyCode {
  if (!storageAvailable()) return defaultCurrency
  const stored = userId
    ? window.localStorage.getItem(userStorageKey(userId)) ?? window.localStorage.getItem(globalStorageKey())
    : window.localStorage.getItem(globalStorageKey())
  return normalizeCurrencyCode(stored)
}

export function writeStoredCurrency(code: CurrencyCode, userId?: string | null) {
  if (!storageAvailable()) return
  window.localStorage.setItem(globalStorageKey(), code)
  if (userId) window.localStorage.setItem(userStorageKey(userId), code)
}

export function setActiveCurrency(code: CurrencyCode) {
  activeCurrency = code
}

export function getActiveCurrency() {
  return activeCurrency
}

export function formatCurrencyAmount(value: number, code: CurrencyCode = activeCurrency) {
  const option = getCurrencyOption(code)
  const amount = new Intl.NumberFormat(option.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

  return `${option.prefix}${amount}`
}
