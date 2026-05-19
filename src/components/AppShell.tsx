import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, FileBarChart, FolderTree, Landmark, LogOut, Moon, Settings, Sun, WalletCards } from 'lucide-react'
import { useEffect } from 'react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { ensureDefaultAccounts, ensureDefaultCategories } from '../services/accounting'
import { useTheme } from '../theme/ThemeProvider'

const navItems = [
  { to: '/', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/movimientos', label: 'Movimientos', icon: WalletCards, end: false },
  { to: '/categorias', label: 'Categorias', icon: FolderTree, end: false },
  { to: '/cuentas', label: 'Cuentas', icon: Landmark, end: false },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart, end: false },
  { to: '/configuracion', label: 'Configuracion', icon: Settings, end: false },
]

export function AppShell() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const sync = useRealtimeSync(user?.id)

  useEffect(() => {
    if (!user) return
    void ensureDefaultCategories(user.id, user.email)
    void ensureDefaultAccounts(user.id).catch(() => undefined)
  }, [user])

  return (
    <div className="min-h-screen bg-paper text-ink dark:bg-slate-950 dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-line bg-white px-4 py-5 shadow-soft dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-600 text-lg font-bold text-white">
            M
          </div>
          <div>
            <p className="text-sm text-muted dark:text-slate-400">Mi contabilidad</p>
            <h1 className="text-lg font-semibold leading-tight">Finanzas personales</h1>
          </div>
        </div>

        <nav className="mt-8 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-ink dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-line bg-paper p-3 dark:border-slate-800 dark:bg-slate-950">
          <p className="truncate text-sm font-medium">{user?.email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-coral-500 hover:text-coral-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-coral-500 dark:hover:text-coral-400"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100">
                PWA sincronizada
              </p>
              <p className="truncate text-sm text-muted dark:text-slate-400">
                {sync.status === 'connected'
                  ? 'Sincronizacion en vivo activa'
                  : sync.status === 'connecting'
                    ? 'Conectando sincronizacion...'
                    : sync.status === 'error'
                      ? 'Sincronizacion en vivo no disponible'
                      : 'Ingresos, gastos y categorias por usuario'}
              </p>
              {sync.error ? <p className="mt-1 text-xs text-coral-600 dark:text-coral-400">{sync.error}</p> : null}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-12px_32px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-6 gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="max-w-full truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
