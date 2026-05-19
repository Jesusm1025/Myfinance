import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getUserCurrencyPreference, saveUserCurrencyPreference } from '../services/accounting'
import {
  currencyOptions,
  getCurrencyOption,
  normalizeCurrencyCode,
  readStoredCurrency,
  setActiveCurrency,
  writeStoredCurrency,
} from '../utils/currency'
import type { CurrencyCode, CurrencyOption } from '../utils/currency'

type CurrencyContextValue = {
  currency: CurrencyCode
  selectedCurrency: CurrencyOption
  options: CurrencyOption[]
  setCurrency: (currency: CurrencyCode) => Promise<void>
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const stored = readStoredCurrency()
    setActiveCurrency(stored)
    return stored
  })

  useEffect(() => {
    const stored = readStoredCurrency(user?.id)
    setActiveCurrency(stored)
    setCurrencyState(stored)

    if (!user) return
    let cancelled = false

    getUserCurrencyPreference(user.id)
      .then((remoteCurrency) => {
        if (cancelled || !remoteCurrency) return
        const nextCurrency = normalizeCurrencyCode(remoteCurrency)
        setActiveCurrency(nextCurrency)
        writeStoredCurrency(nextCurrency, user.id)
        setCurrencyState(nextCurrency)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [user])

  const setCurrency = useCallback(
    async (nextCurrency: CurrencyCode) => {
      const normalizedCurrency = normalizeCurrencyCode(nextCurrency)
      setActiveCurrency(normalizedCurrency)
      writeStoredCurrency(normalizedCurrency, user?.id)
      setCurrencyState(normalizedCurrency)

      if (user) {
        await saveUserCurrencyPreference(user.id, normalizedCurrency)
      }
    },
    [user],
  )

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      selectedCurrency: getCurrencyOption(currency),
      options: currencyOptions,
      setCurrency,
    }),
    [currency, setCurrency],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) throw new Error('useCurrency debe usarse dentro de CurrencyProvider.')
  return context
}
