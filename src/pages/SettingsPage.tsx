import { LogOut, Moon, Smartphone, Sun } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100">
          Configuracion
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
          Preferencias de la app
        </h2>
      </div>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
            {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">Apariencia</h3>
            <p className="mt-1 text-sm text-muted dark:text-slate-400">
              Elige un modo visual comodo para usar desde celular o PC.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  theme === 'light'
                    ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-100'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Sun className="h-4 w-4" />
                Claro
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  theme === 'dark'
                    ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-100'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Moon className="h-4 w-4" />
                Oscuro
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-gold-50 p-2 text-gold-500 dark:bg-gold-500/15">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">Sesion</h3>
            <p className="mt-1 truncate text-sm text-muted dark:text-slate-400">{user?.email}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-coral-500 hover:text-coral-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-coral-500 dark:hover:text-coral-400 sm:w-auto"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesion
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
