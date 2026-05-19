import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { AuthPage } from './pages/AuthPage'
import { AccountsPage } from './pages/AccountsPage'
import { BudgetsPage } from './pages/BudgetsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { DashboardPage } from './pages/DashboardPage'
import { ImportBankEmailsPage } from './pages/ImportBankEmailsPage'
import { MovementsPage } from './pages/MovementsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { CurrencyProvider } from './currency/CurrencyProvider'
import { ThemeProvider } from './theme/ThemeProvider'

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CurrencyProvider>
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
                <Route path="import-bank-emails" element={<ImportBankEmailsPage />} />
                <Route path="categorias" element={<CategoriesPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="cuentas" element={<AccountsPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="presupuestos" element={<BudgetsPage />} />
                <Route path="budgets" element={<BudgetsPage />} />
                <Route path="reportes" element={<ReportsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="configuracion" element={<SettingsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CurrencyProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
