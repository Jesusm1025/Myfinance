import { Link, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, CalendarCheck, CircleDollarSign, FileBarChart, FolderTree, Landmark, LogOut, MailSearch, MoreHorizontal, Moon, PiggyBank, Settings, Sun, WalletCards, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { useCurrency } from '../currency/CurrencyProvider'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { ensureDefaultAccounts, ensureDefaultCategories } from '../services/accounting'
import { useTheme } from '../theme/ThemeProvider'

const primaryNavItems = [
  { to: '/', label: 'Dashboard', mobileLabel: 'Inicio', icon: BarChart3, paths: ['/', '/dashboard'] },
  { to: '/movimientos', label: 'Movimientos', mobileLabel: 'Movs.', icon: WalletCards, paths: ['/movimientos', '/transactions'] },
  { to: '/deudas', label: 'Deudas', mobileLabel: 'Deudas', icon: CircleDollarSign, paths: ['/deudas', '/debts'] },
  { to: '/reportes', label: 'Reportes', mobileLabel: 'Reportes', icon: FileBarChart, paths: ['/reportes', '/reports'] },
]

const monthlyCloseNavItem = {
  to: '/cierre-mensual',
  label: 'Cierre mensual',
  mobileLabel: 'Cierre',
  icon: CalendarCheck,
  paths: ['/cierre-mensual', '/monthly-close'],
}

const managementNavItems = [
  { to: '/categorias', label: 'Categorias', mobileLabel: 'Categ.', icon: FolderTree, paths: ['/categorias', '/categories'] },
  { to: '/cuentas', label: 'Cuentas', mobileLabel: 'Cuentas', icon: Landmark, paths: ['/cuentas', '/accounts'] },
  { to: '/presupuestos', label: 'Presupuestos', mobileLabel: 'Presup.', icon: PiggyBank, paths: ['/presupuestos', '/budgets'] },
]

const automationNavItems = [
  {
    to: '/importar-correos-bancarios',
    label: 'Importar correos',
    mobileLabel: 'Importar',
    icon: MailSearch,
    paths: ['/importar-correos-bancarios', '/importar-correos', '/import-bank-emails'],
  },
]

const settingsNavItems = [
  { to: '/configuracion', label: 'Configuracion / Moneda', mobileLabel: 'Ajustes', icon: Settings, paths: ['/configuracion', '/settings'] },
]

const navGroups = [
  { label: 'Principal', items: [...primaryNavItems, monthlyCloseNavItem] },
  { label: 'Gestion', items: managementNavItems },
  { label: 'Automatizacion', items: automationNavItems },
  { label: 'Configuracion', items: settingsNavItems },
]

const moreNavGroups = [
  { label: 'Principal', items: [monthlyCloseNavItem] },
  ...navGroups.slice(1),
]

function isNavItemActive(pathname: string, item: { paths: string[] }) {
  return item.paths.some((path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)))
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { currency } = useCurrency()
  const sync = useRealtimeSync(user?.id)
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive = useMemo(() => {
    return moreNavGroups.some((group) => group.items.some((item) => isNavItemActive(location.pathname, item)))
  }, [location.pathname])

  useEffect(() => {
    if (!user) return
    void ensureDefaultCategories(user.id, user.email)
    void ensureDefaultAccounts(user.id).catch(() => undefined)
  }, [user])

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen overflow-x-hidden bg-paper text-ink dark:bg-slate-950 dark:text-slate-100">
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

        <nav className="mt-8 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {group.label}
              </p>
              <div className="mt-2 space-y-1">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(location.pathname, item)
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={clsx(
                        'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition',
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-ink dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
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

        <main key={currency} className="mx-auto w-full max-w-7xl px-4 pb-52 pt-5 sm:px-6 lg:w-auto lg:max-w-none lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {moreOpen ? (
        <button
          type="button"
          aria-label="Cerrar menu mas"
          className="fixed inset-0 z-30 bg-slate-950/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}

      <section
        id="mobile-more-menu"
        className={clsx(
          'fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border border-line bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-4 shadow-[0_-18px_48px_rgba(15,23,42,0.18)] transition-transform duration-200 dark:border-slate-800 dark:bg-slate-950 lg:hidden',
          moreOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        aria-hidden={!moreOpen}
      >
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink dark:text-white">Mas opciones</p>
              <p className="text-xs text-muted dark:text-slate-400">Gestion, automatizacion y preferencias</p>
            </div>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Cerrar menu mas"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {moreNavGroups.map((group) => (
              <div key={group.label}>
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {group.label}
                </p>
                <div className="mt-2 grid gap-2">
                  {group.items.map((item) => {
                    const isActive = isNavItemActive(location.pathname, item)
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMoreOpen(false)}
                        className={clsx(
                          'flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-medium transition',
                          isActive
                            ? 'border-brand-500/30 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-500/15 dark:text-brand-100'
                            : 'border-line text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900',
                        )}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-12px_32px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">
          {primaryNavItems.map((item) => {
            const isActive = isNavItemActive(location.pathname, item)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[10px] font-medium transition',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.mobileLabel}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((current) => !current)}
            className={clsx(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[10px] font-medium transition',
              moreActive || moreOpen
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
            aria-expanded={moreOpen}
            aria-current={moreActive ? 'page' : undefined}
            aria-controls="mobile-more-menu"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>Mas</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
