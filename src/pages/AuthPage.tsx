import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { KeyRound, LoaderCircle, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { StatusMessage } from '../components/StatusMessage'

type AuthMode = 'login' | 'register'

export function AuthPage() {
  const { configured, loading, signIn, signUp, user } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageVariant, setMessageVariant] = useState<'error' | 'success'>('error')

  const redirectTo =
    typeof location.state === 'object' && location.state && 'from' in location.state
      ? '/'
      : '/'

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setMessageVariant('error')
    setSubmitting(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        setMessageVariant('success')
        setMessage('Registro creado. Revisa tu correo si Supabase pide confirmacion.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la accion.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-paper px-4 py-8 text-ink dark:bg-slate-950 dark:text-slate-100 lg:grid-cols-[1fr_1.1fr] lg:px-8">
      <section className="mx-auto flex w-full max-w-xl flex-col justify-center">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-brand-600 text-xl font-bold text-white">
            M
          </div>
          <div>
            <p className="text-sm text-muted dark:text-slate-400">PWA personal</p>
            <h1 className="text-2xl font-semibold">Mi Contabilidad</h1>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900 sm:p-7">
          <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                mode === 'login'
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-100'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Iniciar sesion
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                mode === 'register'
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-100'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Registrarse
            </button>
          </div>

          {!configured ? (
            <div className="mt-5 rounded-lg border border-gold-500/30 bg-gold-50 p-4 text-sm text-slate-700 dark:bg-gold-500/10 dark:text-slate-200">
              Crea un archivo <code className="font-mono">.env</code> basado en{' '}
              <code className="font-mono">.env.example</code> con la URL y la anon key de Supabase.
            </div>
          ) : null}

          {message ? <div className="mt-5"><StatusMessage message={message} variant={messageVariant} /></div> : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Correo</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-3 text-base text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20"
                placeholder="tu@email.com"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Contrasena</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-3 text-base text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20"
                placeholder="Minimo 6 caracteres"
              />
            </label>
            <button
              type="submit"
              disabled={!configured || submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
              {mode === 'login' ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </section>

      <section className="hidden items-center justify-center px-8 lg:flex">
        <div className="max-w-lg rounded-lg border border-line bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <KeyRound className="h-10 w-10 text-brand-600" />
          <h2 className="mt-5 text-3xl font-semibold leading-tight">
            Datos sincronizados y separados por usuario.
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Esta base ya usa Supabase Auth y esta preparada para guardar movimientos,
            categorias, filtros y resumenes mensuales con politicas RLS.
          </p>
        </div>
      </section>
    </main>
  )
}
