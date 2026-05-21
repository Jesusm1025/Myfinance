import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { AdvisorChat } from '../components/AdvisorChat'
import { AdvisorInsightCards } from '../components/AdvisorInsightCards'
import { SkeletonList, SkeletonStats } from '../components/Skeleton'
import { StatusMessage } from '../components/StatusMessage'
import {
  accountsChangedEvent,
  budgetsChangedEvent,
  debtsChangedEvent,
  movementsChangedEvent,
  savingsGoalsChangedEvent,
} from '../events/financeEvents'
import {
  listAccountTransfers,
  listAccounts,
  listAllMovements,
  listCategories,
  listDebtInstallments,
  listDebtPayments,
  listDebts,
  listMonthlyBudgets,
  listSavingsGoalContributions,
  listSavingsGoals,
} from '../services/accounting'
import type {
  Account,
  AccountTransfer,
  Category,
  Debt,
  DebtInstallment,
  DebtPayment,
  MonthlyBudget,
  Movement,
  SavingsGoal,
  SavingsGoalContribution,
} from '../types/finance'
import { currentMonthValue } from '../utils/format'
import { buildAdvisorAutoInsights, buildAdvisorInsights, type FinancialAdvisorData } from '../utils/financialAdvisor'
import { detectRecurringExpenses } from '../utils/recurringExpenses'

export function FinancialAdvisorPage() {
  const { user } = useAuth()
  const [month] = useState(currentMonthValue())
  const [movements, setMovements] = useState<Movement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([])
  const [debtInstallments, setDebtInstallments] = useState<DebtInstallment[]>([])
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [savingsGoalContributions, setSavingsGoalContributions] = useState<SavingsGoalContribution[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountTransfers, setAccountTransfers] = useState<AccountTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAdvisorData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [
        movementData,
        categoryData,
        budgetData,
        debtData,
        paymentData,
        installmentData,
        goalData,
        contributionData,
        accountData,
        transferData,
      ] = await Promise.all([
        listAllMovements(user.id),
        listCategories(user.id).catch(() => [] as Category[]),
        listMonthlyBudgets(user.id, month).catch(() => [] as MonthlyBudget[]),
        listDebts(user.id).catch(() => [] as Debt[]),
        listDebtPayments(user.id).catch(() => [] as DebtPayment[]),
        listDebtInstallments(user.id).catch(() => [] as DebtInstallment[]),
        listSavingsGoals(user.id).catch(() => [] as SavingsGoal[]),
        listSavingsGoalContributions(user.id).catch(() => [] as SavingsGoalContribution[]),
        listAccounts(user.id).catch(() => [] as Account[]),
        listAccountTransfers(user.id).catch(() => [] as AccountTransfer[]),
      ])

      setMovements(movementData)
      setCategories(categoryData)
      setBudgets(budgetData)
      setDebts(debtData)
      setDebtPayments(paymentData)
      setDebtInstallments(installmentData)
      setSavingsGoals(goalData)
      setSavingsGoalContributions(contributionData)
      setAccounts(accountData)
      setAccountTransfers(transferData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el asesor financiero.')
    } finally {
      setLoading(false)
    }
  }, [month, user])

  useEffect(() => {
    void loadAdvisorData()
  }, [loadAdvisorData])

  useEffect(() => {
    window.addEventListener(movementsChangedEvent, loadAdvisorData)
    window.addEventListener(budgetsChangedEvent, loadAdvisorData)
    window.addEventListener(debtsChangedEvent, loadAdvisorData)
    window.addEventListener(savingsGoalsChangedEvent, loadAdvisorData)
    window.addEventListener(accountsChangedEvent, loadAdvisorData)
    return () => {
      window.removeEventListener(movementsChangedEvent, loadAdvisorData)
      window.removeEventListener(budgetsChangedEvent, loadAdvisorData)
      window.removeEventListener(debtsChangedEvent, loadAdvisorData)
      window.removeEventListener(savingsGoalsChangedEvent, loadAdvisorData)
      window.removeEventListener(accountsChangedEvent, loadAdvisorData)
    }
  }, [loadAdvisorData])

  const recurringExpenses = useMemo(() => detectRecurringExpenses(movements), [movements])
  const advisorData = useMemo<FinancialAdvisorData>(
    () => ({
      month,
      movements,
      categories,
      budgets,
      debts,
      debtPayments,
      debtInstallments,
      savingsGoals,
      savingsGoalContributions,
      accounts,
      accountTransfers,
      recurringExpenses: recurringExpenses.items,
    }),
    [
      accountTransfers,
      accounts,
      budgets,
      categories,
      debtInstallments,
      debtPayments,
      debts,
      month,
      movements,
      recurringExpenses.items,
      savingsGoalContributions,
      savingsGoals,
    ],
  )
  const insights = useMemo(() => buildAdvisorInsights(advisorData), [advisorData])
  const autoInsights = useMemo(() => buildAdvisorAutoInsights(advisorData), [advisorData])

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="premium-card overflow-hidden rounded-lg border border-line bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="bg-gradient-to-br from-brand-50 via-white to-slate-50 p-4 dark:from-brand-500/10 dark:via-slate-900 dark:to-slate-900 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100 sm:text-sm">
                Asesor financiero
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-normal sm:text-3xl">
                Orientacion basada en tus datos
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Respuestas por reglas locales, con contexto temporal de esta conversacion. No envia datos a servicios externos.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-brand-500/20 bg-white/80 px-3 py-2 text-xs leading-5 text-brand-700 dark:border-brand-400/20 dark:bg-slate-950/70 dark:text-brand-100 sm:text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Orientacion general; no sustituye asesoria financiera profesional.</span>
            </div>
          </div>
        </div>
      </div>

      {error ? <StatusMessage message={error} /> : null}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <SkeletonList rows={1} itemHeight="h-[560px]" />
          <SkeletonStats count={5} />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <aside className="order-first space-y-3 xl:order-last xl:sticky xl:top-24 xl:self-start">
            <div>
              <h3 className="text-sm font-semibold text-ink dark:text-white sm:text-base">Lectura rapida</h3>
              <p className="text-xs text-muted dark:text-slate-400">Indicadores compactos antes de preguntar.</p>
            </div>
            <AdvisorInsightCards insights={insights} />
          </aside>
          <AdvisorChat data={advisorData} autoInsights={autoInsights} />
        </div>
      )}
    </div>
  )
}
