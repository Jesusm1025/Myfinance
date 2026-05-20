import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRightLeft, Edit2, Landmark, LoaderCircle, Save, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { SkeletonList, SkeletonStats } from '../components/Skeleton'
import { StatusMessage } from '../components/StatusMessage'
import { accountsChangedEvent, movementsChangedEvent } from '../events/financeEvents'
import {
  deleteAccount,
  deleteAccountTransfer,
  ensureDefaultAccounts,
  listAccountTransfers,
  listAccounts,
  listAllMovements,
  saveAccount,
  saveAccountTransfer,
} from '../services/accounting'
import type { Account, AccountFormValues, AccountTransfer, AccountType, TransferFormValues } from '../types/finance'
import { buildAccountBalances, totalAccountBalance } from '../utils/accounts'
import { accountTypeLabel, formatDate, formatMoney } from '../utils/format'

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20'

const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'

const swatches = ['#198c7c', '#ee6c4d', '#d99f18', '#2563eb', '#7c3aed', '#0f766e', '#db2777', '#64748b']

const accountTypes: AccountType[] = ['cash', 'bank', 'debit_card', 'credit_card', 'savings', 'other']

const initialAccount: AccountFormValues = {
  name: '',
  type: 'cash',
  color: '#198c7c',
  initial_balance: '0',
}

const initialTransfer: TransferFormValues = {
  from_account_id: '',
  to_account_id: '',
  amount: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
}

export function AccountsPage() {
  const { user } = useAuth()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transfers, setTransfers] = useState<AccountTransfer[]>([])
  const [balanceInputs, setBalanceInputs] = useState<ReturnType<typeof buildAccountBalances>>([])
  const [accountValues, setAccountValues] = useState<AccountFormValues>(initialAccount)
  const [transferValues, setTransferValues] = useState<TransferFormValues>(initialTransfer)
  const [loading, setLoading] = useState(true)
  const [submittingAccount, setSubmittingAccount] = useState(false)
  const [submittingTransfer, setSubmittingTransfer] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      await ensureDefaultAccounts(user.id)
      const [accountData, movementData, transferData] = await Promise.all([
        listAccounts(user.id),
        listAllMovements(user.id),
        listAccountTransfers(user.id),
      ])
      setAccounts(accountData)
      setTransfers(transferData)
      setAccountValues((current) => ({
        ...current,
        type: current.type,
      }))
      setTransferValues((current) => ({
        ...current,
        from_account_id: current.from_account_id || accountData[0]?.id || '',
        to_account_id: current.to_account_id || accountData[1]?.id || '',
      }))
      setBalanceInputs(buildAccountBalances(accountData, movementData, transferData))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las cuentas.')
    } finally {
      setLoading(false)
    }
  }, [user])

  const totalBalance = useMemo(() => totalAccountBalance(balanceInputs), [balanceInputs])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    window.addEventListener(accountsChangedEvent, refresh)
    window.addEventListener(movementsChangedEvent, refresh)
    return () => {
      window.removeEventListener(accountsChangedEvent, refresh)
      window.removeEventListener(movementsChangedEvent, refresh)
    }
  }, [refresh])

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setSubmittingAccount(true)
    setError('')
    setSuccess('')
    try {
      await saveAccount(user.id, accountValues)
      setSuccess(accountValues.id ? 'Cuenta actualizada correctamente.' : 'Cuenta creada correctamente.')
      setAccountValues(initialAccount)
      await refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la cuenta.')
    } finally {
      setSubmittingAccount(false)
    }
  }

  async function handleTransferSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setSubmittingTransfer(true)
    setError('')
    setSuccess('')
    try {
      await saveAccountTransfer(user.id, transferValues)
      setSuccess(transferValues.id ? 'Transferencia actualizada correctamente.' : 'Transferencia creada correctamente.')
      setTransferValues({
        ...initialTransfer,
        from_account_id: accounts[0]?.id || '',
        to_account_id: accounts[1]?.id || '',
      })
      await refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la transferencia.')
    } finally {
      setSubmittingTransfer(false)
    }
  }

  async function handleDeleteAccount(account: Account) {
    if (!user) return
    const confirmed = await confirm({
      title: 'Eliminar cuenta',
      description: `Eliminar cuenta "${account.name}"? Si tiene movimientos asociados, la app evitara inconsistencias segun las reglas actuales.`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!confirmed) return
    setError('')
    setSuccess('')
    try {
      await deleteAccount(user.id, account.id)
      setSuccess('Cuenta eliminada correctamente.')
      await refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la cuenta.')
    }
  }

  async function handleDeleteTransfer(transfer: AccountTransfer) {
    if (!user) return
    const confirmed = await confirm({
      title: 'Eliminar transferencia',
      description: 'Eliminar esta transferencia? Esta accion no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!confirmed) return
    setError('')
    setSuccess('')
    try {
      await deleteAccountTransfer(user.id, transfer.id)
      setSuccess('Transferencia eliminada correctamente.')
      await refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la transferencia.')
    }
  }

  function editAccount(account: Account) {
    setAccountValues({
      id: account.id,
      name: account.name,
      type: account.type,
      color: account.color,
      initial_balance: String(account.initial_balance),
    })
  }

  function editTransfer(transfer: AccountTransfer) {
    setTransferValues({
      id: transfer.id,
      from_account_id: transfer.from_account_id,
      to_account_id: transfer.to_account_id,
      amount: String(transfer.amount),
      description: transfer.description ?? '',
      date: transfer.transfer_date,
    })
  }

  return (
    <>
      <ConfirmDialog />
      <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100">
          Cuentas y bolsillos
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
          Saldos por cuenta
        </h2>
      </div>

      {error ? <StatusMessage message={error} /> : null}
      {success ? <StatusMessage message={success} variant="success" /> : null}

      {loading ? (
        <SkeletonStats count={3} />
      ) : (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <article className="col-span-2 rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5 xl:col-span-2">
            <p className="text-sm text-muted dark:text-slate-400">Balance total</p>
            <p className="mt-2 text-3xl font-semibold tracking-normal text-ink dark:text-white">
              {formatMoney(totalBalance)}
            </p>
          </article>
          <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <p className="text-sm text-muted dark:text-slate-400">Cuentas</p>
            <p className="mt-2 text-3xl font-semibold tracking-normal text-ink dark:text-white">{accounts.length}</p>
          </article>
          <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <p className="text-sm text-muted dark:text-slate-400">Transferencias</p>
            <p className="mt-2 text-3xl font-semibold tracking-normal text-ink dark:text-white">{transfers.length}</p>
          </article>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <AccountForm
            values={accountValues}
            submitting={submittingAccount}
            onSubmit={handleAccountSubmit}
            onChange={setAccountValues}
            onCancel={() => setAccountValues(initialAccount)}
          />
          <TransferForm
            accounts={accounts}
            values={transferValues}
            submitting={submittingTransfer}
            onSubmit={handleTransferSubmit}
            onChange={setTransferValues}
            onCancel={() =>
              setTransferValues({
                ...initialTransfer,
                from_account_id: accounts[0]?.id || '',
                to_account_id: accounts[1]?.id || '',
              })
            }
          />
        </div>

        <div className="space-y-5">
          <section className="rounded-lg border border-line bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-line p-4 dark:border-slate-800 sm:p-5">
              <h3 className="text-lg font-semibold">Balance por cuenta</h3>
            </div>
            {loading ? (
              <div className="p-5">
                <SkeletonList rows={3} itemHeight="h-20" />
              </div>
            ) : balanceInputs.length ? (
              <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
                {balanceInputs.map((account) => (
                  <article key={account.id} className="rounded-lg border border-line p-4 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-1 h-10 w-10 rounded-lg" style={{ backgroundColor: account.color }} />
                        <div className="min-w-0">
                          <h4 className="truncate font-semibold">{account.name}</h4>
                          <p className="text-sm text-muted dark:text-slate-400">{accountTypeLabel(account.type)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => editAccount(account)}
                          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label="Editar cuenta"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAccount(account)}
                          className="rounded-lg p-2 text-coral-600 hover:bg-coral-50 dark:text-coral-400 dark:hover:bg-coral-500/10"
                          aria-label="Eliminar cuenta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-4 text-2xl font-semibold tracking-normal">{formatMoney(account.balance)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted dark:text-slate-400">
                      <span>Ingresos: {formatMoney(account.income)}</span>
                      <span>Gastos: {formatMoney(account.expenses)}</span>
                      <span>Entrada transf.: {formatMoney(account.incomingTransfers)}</span>
                      <span>Salida transf.: {formatMoney(account.outgoingTransfers)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="p-5">
                <EmptyState title="Sin cuentas" detail="Crea una cuenta para empezar a controlar tus saldos." />
              </div>
            )}
          </section>

          <TransfersList
            transfers={transfers}
            onEdit={editTransfer}
            onDelete={(transfer) => void handleDeleteTransfer(transfer)}
          />
        </div>
      </section>
      </div>
    </>
  )
}

function AccountForm({
  values,
  submitting,
  onSubmit,
  onChange,
  onCancel,
}: {
  values: AccountFormValues
  submitting: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: (values: AccountFormValues) => void
  onCancel: () => void
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">{values.id ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
          <p className="text-sm text-muted dark:text-slate-400">Bolsillos, bancos, tarjetas y ahorros.</p>
        </div>
      </div>

      <form className="mt-5 grid grid-cols-2 gap-3 sm:block sm:space-y-4" onSubmit={onSubmit}>
        <label className="col-span-2 block">
          <span className={labelClass}>Nombre</span>
          <input
            required
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            className={`mt-1 ${fieldClass}`}
            placeholder="Cuenta bancaria"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Tipo</span>
          <select
            value={values.type}
            onChange={(event) => onChange({ ...values, type: event.target.value as AccountType })}
            className={`mt-1 ${fieldClass}`}
          >
            {accountTypes.map((type) => (
              <option key={type} value={type}>
                {accountTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Balance inicial</span>
          <input
            type="number"
            step="0.01"
            value={values.initial_balance}
            onChange={(event) => onChange({ ...values, initial_balance: event.target.value })}
            className={`mt-1 ${fieldClass}`}
            placeholder="0.00"
          />
        </label>
        <div className="col-span-2">
          <span className={labelClass}>Color</span>
          <div className="mt-2 grid grid-cols-8 gap-1.5 sm:gap-2">
            {swatches.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onChange({ ...values, color })}
                className={clsx(
                  'h-8 rounded-lg border-2 sm:h-9',
                  values.color === color ? 'border-ink dark:border-white' : 'border-transparent',
                )}
                style={{ backgroundColor: color }}
                aria-label={`Color ${color}`}
              />
            ))}
          </div>
        </div>
        <div className="fixed inset-x-4 bottom-24 z-30 col-span-2 flex gap-2 rounded-lg bg-white/95 py-2 backdrop-blur dark:bg-slate-900/95 sm:static sm:inset-auto sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Guardar
          </button>
          {values.id ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-line px-4 py-3 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Cancelar edicion"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}

function TransferForm({
  accounts,
  values,
  submitting,
  onSubmit,
  onChange,
  onCancel,
}: {
  accounts: Account[]
  values: TransferFormValues
  submitting: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: (values: TransferFormValues) => void
  onCancel: () => void
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-gold-50 p-2 text-gold-500 dark:bg-gold-500/15">
          <ArrowRightLeft className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">{values.id ? 'Editar transferencia' : 'Transferencia'}</h3>
          <p className="text-sm text-muted dark:text-slate-400">Mueve dinero entre cuentas sin afectar ingresos/gastos.</p>
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className={labelClass}>Desde</span>
          <select
            required
            value={values.from_account_id}
            onChange={(event) => onChange({ ...values, from_account_id: event.target.value })}
            className={`mt-1 ${fieldClass}`}
          >
            <option value="">Cuenta origen</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Hacia</span>
          <select
            required
            value={values.to_account_id}
            onChange={(event) => onChange({ ...values, to_account_id: event.target.value })}
            className={`mt-1 ${fieldClass}`}
          >
            <option value="">Cuenta destino</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <label className="block">
            <span className={labelClass}>Monto</span>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={values.amount}
              onChange={(event) => onChange({ ...values, amount: event.target.value })}
              className={`mt-1 ${fieldClass}`}
              placeholder="0.00"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Fecha</span>
            <input
              type="date"
              required
              value={values.date}
              onChange={(event) => onChange({ ...values, date: event.target.value })}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Descripcion</span>
          <textarea
            value={values.description}
            onChange={(event) => onChange({ ...values, description: event.target.value })}
            className={`mt-1 min-h-20 resize-y ${fieldClass}`}
            placeholder="Detalle opcional"
          />
        </label>
        <div className="fixed inset-x-4 bottom-24 z-30 flex gap-2 rounded-lg bg-white/95 py-2 backdrop-blur dark:bg-slate-900/95 sm:static sm:inset-auto sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <button
            type="submit"
            disabled={submitting || accounts.length < 2}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Guardar
          </button>
          {values.id ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-line px-4 py-3 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Cancelar edicion"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}

function TransfersList({
  transfers,
  onEdit,
  onDelete,
}: {
  transfers: AccountTransfer[]
  onEdit: (transfer: AccountTransfer) => void
  onDelete: (transfer: AccountTransfer) => void
}) {
  return (
    <section className="rounded-lg border border-line bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-line p-4 dark:border-slate-800 sm:p-5">
        <h3 className="text-lg font-semibold">Transferencias</h3>
      </div>
      {transfers.length ? (
        <div className="divide-y divide-line dark:divide-slate-800">
          {transfers.map((transfer) => (
            <article key={transfer.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold">
                  {transfer.from_account?.name ?? 'Origen'} a {transfer.to_account?.name ?? 'Destino'}
                </p>
                <p className="text-sm text-muted dark:text-slate-400">
                  {formatDate(transfer.transfer_date)} {transfer.description ? `- ${transfer.description}` : ''}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-ink dark:text-white">{formatMoney(Number(transfer.amount))}</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(transfer)}
                    className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Editar transferencia"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(transfer)}
                    className="rounded-lg p-2 text-coral-600 hover:bg-coral-50 dark:text-coral-400 dark:hover:bg-coral-500/10"
                    aria-label="Eliminar transferencia"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="p-5">
          <EmptyState title="Sin transferencias" detail="Cuando muevas dinero entre cuentas, aparecera aqui." />
        </div>
      )}
    </section>
  )
}
