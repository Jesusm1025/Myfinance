import type { CurrencyCode } from '../utils/currency'
import { isSchemaMissingError, requireSupabase } from './supabaseClient'

function isPreferencesSchemaError(error: { message?: string; details?: string } | null) {
  return isSchemaMissingError(error, ['user_preferences', 'schema cache', 'does not exist'])
}

export async function getUserCurrencyPreference(userId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_preferences')
    .select('currency')
    .eq('user_id', userId)
    .maybeSingle()

  if (error && isPreferencesSchemaError(error)) return null
  if (error) throw error
  return data?.currency as CurrencyCode | null | undefined
}

export async function saveUserCurrencyPreference(userId: string, currency: CurrencyCode) {
  const client = requireSupabase()
  const { error } = await client.from('user_preferences').upsert(
    {
      user_id: userId,
      currency,
    },
    { onConflict: 'user_id' },
  )

  if (error && isPreferencesSchemaError(error)) return
  if (error) throw error
}
