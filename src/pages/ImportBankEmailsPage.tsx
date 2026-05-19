import { useCallback, useEffect, useMemo, useState } from 'react'
import { BanknoteArrowDown, ClipboardPaste, LoaderCircle, MailSearch, Save, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState } from '../components/EmptyState'
import { StatusMessage } from '../components/StatusMessage'
import { accountsChangedEvent, categoriesChangedEvent } from '../events/financeEvents'
import { bankMovementKindLabel, parseBankEmail } from '../lib/bankEmailParser'
import type { ParsedBankEmail } from '../lib/bankEmailParser'
import { listAccounts, listCategories, saveMovement } from '../services/accounting'
import type { Account, Category, MovementFormValues, MovementType, PaymentMethod } from '../types/finance'
import { formatMoney, movementTypeLabel, paymentMethodLabel } from '../utils/format'

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20'

const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'

const initialEmailText = ''

const movementKindPaymentMap: Record<ParsedBankEmail['movementKind'], PaymentMethod> = {
  expense: 'card',
  income: 'transfer',
  transfer: 'transfer',
  withdrawal: 'cash',
  payment: 'transfer',
}

function findCategoryId(categories: Category[], type: MovementType, suggestedCategory: string) {
  const normalizedSuggestion = suggestedCategory.toLowerCase()
  return (
    categories.find(
      (category) => category.type === type && category.name.toLowerCase() === normalizedSuggestion,
    )?.id ??
    categories.find((category) => category.type === type && category.name.toLowerCase() === 'otros')?.id ??
    ''
  )
}

function firstAccountId(accounts: Account[], parsed: ParsedBankEmail | null) {
  if (!accounts.length) return ''
  if (parsed?.bank && parsed.bank !== 'Banco no identificado') {
    const bankText = parsed.bank.toLowerCase()
    const match = accounts.find((account) => bankText.includes(account.name.toLowerCase()) || account.name.toLowerCase().includes(bankText))
    if (match) return match.id
  }
  return accounts[0].id
}

function parsedToMovement(parsed: ParsedBankEmail, categories: Category[], accounts: Account[]): MovementFormValues {
  const type = parsed.transactionType
  const categoryId = findCategoryId(categories, type, parsed.suggestedCategory)

  return {
    type,
    amount: parsed.amount ? String(parsed.amount) : '',
    category_id: categoryId,
    account_id: firstAccountId(accounts, parsed),
    description: parsed.description,
    date: parsed.date,
    payment_method: movementKindPaymentMap[parsed.movementKind],
  }
}

export function ImportBankEmailsPage() {
  const { user } = useAuth()
  const [emailText, setEmailText] = useState(initialEmailText)
  const [parsed, setParsed] = useState<ParsedBankEmail | null>(null)
  const [values, setValues] = useState<MovementFormValues | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadCatalogs = useCallback(async () => {
    if (!user) return
    setLoadingCatalogs(true)
    setError('')
    try {
      const [categoryData, accountData] = await Promise.all([
        listCategories(user.id),
        listAccounts(user.id).catch(() => [] as Account[]),
      ])
      setCategories(categoryData)
      setAccounts(accountData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar categorias y cuentas.')
    } finally {
      setLoadingCatalogs(false)
    }
  }, [user])

  useEffect(() => {
    void loadCatalogs()
  }, [loadCatalogs])

  useEffect(() => {
    window.addEventListener(categoriesChangedEvent, loadCatalogs)
    window.addEventListener(accountsChangedEvent, loadCatalogs)
    return () => {
      window.removeEventListener(categoriesChangedEvent, loadCatalogs)
      window.removeEventListener(accountsChangedEvent, loadCatalogs)
    }
  }, [loadCatalogs])

  const compatibleCategories = useMemo(
    () => categories.filter((category) => category.type === values?.type),
    [categories, values?.type],
  )

  function analyzeEmail() {
    setError('')
    setSuccess('')
    const nextParsed = parseBankEmail(emailText)
    setParsed(nextParsed)
    setValues(parsedToMovement(nextParsed, categories, accounts))
  }

  async function saveDetectedMovement() {
    if (!user || !values) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await saveMovement(user.id, values)
      setSuccess('Movimiento importado correctamente.')
      setEmailText(initialEmailText)
      setParsed(null)
      setValues(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el movimiento detectado.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <section className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
            <MailSearch className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100">
              Importar correos bancarios
            </p>
            <h2 className="mt-1 text-xl font-semibold">Pega una notificacion bancaria</h2>
            <p className="mt-1 text-sm text-muted dark:text-slate-400">
              Compatible inicialmente con Banco Popular, Banreservas, BHD y Scotiabank.
            </p>
          </div>
        </div>

        {error ? <div className="mt-4"><StatusMessage message={error} /></div> : null}
        {success ? <div className="mt-4"><StatusMessage message={success} variant="success" /></div> : null}

        <label className="mt-5 block">
          <span className={labelClass}>Texto del correo</span>
          <textarea
            value={emailText}
            onChange={(event) => setEmailText(event.target.value)}
            className={`mt-1 min-h-72 resize-y ${fieldClass}`}
            placeholder="Pega aqui el texto completo de la notificacion bancaria..."
          />
        </label>

        <button
          type="button"
          disabled={!emailText.trim() || loadingCatalogs}
          onClick={analyzeEmail}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingCatalogs ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          Analizar correo
        </button>

        <div className="mt-4 rounded-lg border border-line bg-paper p-3 text-sm text-muted dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          <div className="flex items-start gap-2">
            <ClipboardPaste className="mt-0.5 h-4 w-4 text-brand-700 dark:text-brand-100" />
            <p>
              En una siguiente fase, Gmail OAuth puede leer el body del correo y enviarlo directamente a este mismo parser.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {parsed && values ? (
          <>
            <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
                    <BanknoteArrowDown className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Vista previa detectada</h3>
                    <p className="text-sm text-muted dark:text-slate-400">
                      Revisa y edita los datos antes de registrar la transaccion.
                    </p>
                  </div>
                </div>
                <span
                  className={clsx(
                    'inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold',
                    parsed.confidence >= 75
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
                      : 'bg-gold-50 text-gold-500 dark:bg-gold-500/15',
                  )}
                >
                  Confianza {parsed.confidence}%
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <PreviewItem label="Banco" value={parsed.bank} />
                <PreviewItem label="Tipo detectado" value={bankMovementKindLabel(parsed.movementKind)} />
                <PreviewItem label="Moneda detectada" value={parsed.currency ?? 'No detectada'} />
                <PreviewItem label="Categoria sugerida" value={parsed.suggestedCategory} />
              </div>

              {parsed.warnings.length ? (
                <div className="mt-4 rounded-lg border border-gold-500/30 bg-gold-50 p-3 text-sm text-gold-500 dark:bg-gold-500/10">
                  {parsed.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 md:col-span-2">
                  {(['expense', 'income'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setValues((current) =>
                          current ? { ...current, type, category_id: findCategoryId(categories, type, parsed.suggestedCategory) } : current,
                        )
                      }
                      className={clsx(
                        'rounded-md px-3 py-2 text-sm font-medium',
                        values.type === type
                          ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-100'
                          : 'text-slate-600 dark:text-slate-300',
                      )}
                    >
                      {movementTypeLabel(type)}
                    </button>
                  ))}
                </div>

                <label>
                  <span className={labelClass}>Monto</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={values.amount}
                    onChange={(event) => setValues((current) => current ? { ...current, amount: event.target.value } : current)}
                    className={`mt-1 ${fieldClass}`}
                  />
                </label>

                <label>
                  <span className={labelClass}>Fecha</span>
                  <input
                    type="date"
                    value={values.date}
                    onChange={(event) => setValues((current) => current ? { ...current, date: event.target.value } : current)}
                    className={`mt-1 ${fieldClass}`}
                  />
                </label>

                <label>
                  <span className={labelClass}>Categoria</span>
                  <select
                    value={values.category_id}
                    onChange={(event) => setValues((current) => current ? { ...current, category_id: event.target.value } : current)}
                    className={`mt-1 ${fieldClass}`}
                  >
                    <option value="">Selecciona una categoria</option>
                    {compatibleCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className={labelClass}>Cuenta</span>
                  <select
                    value={values.account_id}
                    onChange={(event) => setValues((current) => current ? { ...current, account_id: event.target.value } : current)}
                    className={`mt-1 ${fieldClass}`}
                  >
                    <option value="">Selecciona una cuenta</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className={labelClass}>Metodo de pago</span>
                  <select
                    value={values.payment_method}
                    onChange={(event) =>
                      setValues((current) =>
                        current ? { ...current, payment_method: event.target.value as PaymentMethod } : current,
                      )
                    }
                    className={`mt-1 ${fieldClass}`}
                  >
                    <option value="cash">{paymentMethodLabel('cash')}</option>
                    <option value="card">{paymentMethodLabel('card')}</option>
                    <option value="transfer">{paymentMethodLabel('transfer')}</option>
                    <option value="other">{paymentMethodLabel('other')}</option>
                  </select>
                </label>

                <label className="md:col-span-2">
                  <span className={labelClass}>Descripcion</span>
                  <textarea
                    value={values.description}
                    onChange={(event) => setValues((current) => current ? { ...current, description: event.target.value } : current)}
                    className={`mt-1 min-h-24 resize-y ${fieldClass}`}
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted dark:text-slate-400">
                  Se guardara como {movementTypeLabel(values.type).toLowerCase()} por{' '}
                  <span className="font-semibold text-ink dark:text-white">
                    {values.amount ? formatMoney(Number(values.amount)) : '0.00'}
                  </span>
                  .
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveDetectedMovement()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  Registrar transaccion
                </button>
              </div>
            </article>
          </>
        ) : (
          <EmptyState
            title="Sin correo analizado"
            detail="Pega una notificacion bancaria y presiona Analizar correo para ver una vista previa editable."
          />
        )}

        <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h3 className="font-semibold">Bancos soportados inicialmente</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {['Banco Popular', 'Banreservas', 'BHD', 'Scotiabank'].map((bank) => (
              <div key={bank} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
                {bank}
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted dark:text-slate-400">
            El parser acepta variaciones comunes, pero siempre conviene revisar la vista previa antes de guardar.
          </p>
        </article>
      </section>
    </div>
  )
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-3 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-slate-400">{label}</p>
      <p className="mt-1 truncate font-semibold">{value}</p>
    </div>
  )
}
