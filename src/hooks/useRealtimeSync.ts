import { useEffect, useState } from 'react'
import {
  notifyAccountsChanged,
  notifyBudgetsChanged,
  notifyCategoriesChanged,
  notifyDebtsChanged,
  notifyMovementsChanged,
} from '../events/financeEvents'
import { supabase } from '../lib/supabase'

type SyncStatus = 'idle' | 'connecting' | 'connected' | 'error'

export function useRealtimeSync(userId?: string) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase || !userId) {
      setStatus('idle')
      setError('')
      return
    }

    setStatus('connecting')
    setError('')

    const client = supabase
    const channel = client
      .channel(`finance-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        () => notifyMovementsChanged(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `user_id=eq.${userId}`,
        },
        () => notifyCategoriesChanged(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monthly_budgets',
          filter: `user_id=eq.${userId}`,
        },
        () => notifyBudgetsChanged(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${userId}`,
        },
        () => notifyAccountsChanged(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'account_transfers',
          filter: `user_id=eq.${userId}`,
        },
        () => notifyAccountsChanged(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debts',
          filter: `user_id=eq.${userId}`,
        },
        () => notifyDebtsChanged(),
      )
      .subscribe((nextStatus, realtimeError) => {
        if (nextStatus === 'SUBSCRIBED') {
          setStatus('connected')
          setError('')
          return
        }

        if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') {
          setStatus('error')
          setError(realtimeError?.message ?? 'No se pudo conectar la sincronizacion en tiempo real.')
        }
      })

    return () => {
      void client.removeChannel(channel)
    }
  }, [userId])

  return { status, error }
}
