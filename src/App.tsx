import { lazy, Suspense } from 'react'
import { LoaderCircle } from 'lucide-react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { CurrencyProvider } from './currency/CurrencyProvider'
import { ThemeProvider } from './theme/ThemeProvider'

const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const AccountsPage = lazy(() => import('./pages/AccountsPage').then((module) => ({ default: module.AccountsPage })))
const BudgetsPage = lazy(() => import('./pages/BudgetsPage').then((module) => ({ default: module.BudgetsPage })))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((module) => ({ default: module.CategoriesPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const DebtsPage = lazy(() => import('./pages/DebtsPage').then((module) => ({ default: module.DebtsPage })))
const ImportBankEmailsPage = lazy(() => import('./pages/ImportBankEmailsPage').then((module) => ({ default: module.ImportBankEmailsPage })))
const MonthlyClosePage = lazy(() => import('./pages/MonthlyClosePage').then((module) => ({ default: module.MonthlyClosePage })))
const MovementsPage = lazy(() => import('./pages/MovementsPage').then((module) => ({ default: module.MovementsPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const SavingsGoalsPage = lazy(() => import('./pages/SavingsGoalsPage').then((module) => ({ default: module.SavingsGoalsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-brand-700 dark:bg-slate-950 dark:text-brand-100">
      <LoaderCircle className="h-6 w-6 animate-spin" aria-label="Cargando" />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CurrencyProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="movimientos" element={<MovementsPage />} />
                  <Route path="transactions" element={<MovementsPage />} />
                  <Route path="importar-correos-bancarios" element={<ImportBankEmailsPage />} />
                  <Route path="importar-correos" element={<ImportBankEmailsPage />} />
                  <Route path="import-bank-emails" element={<ImportBankEmailsPage />} />
                  <Route path="categorias" element={<CategoriesPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="cuentas" element={<AccountsPage />} />
                  <Route path="accounts" element={<AccountsPage />} />
                  <Route path="deudas" element={<DebtsPage />} />
                  <Route path="debts" element={<DebtsPage />} />
                  <Route path="presupuestos" element={<BudgetsPage />} />
                  <Route path="budgets" element={<BudgetsPage />} />
                  <Route path="metas-ahorro" element={<SavingsGoalsPage />} />
                  <Route path="savings-goals" element={<SavingsGoalsPage />} />
                  <Route path="reportes" element={<ReportsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="cierre-mensual" element={<MonthlyClosePage />} />
                  <Route path="monthly-close" element={<MonthlyClosePage />} />
                  <Route path="configuracion" element={<SettingsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </CurrencyProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
