import { useCallback, useEffect, useMemo, useState } from 'react'
import { BanknoteArrowDown, CheckCircle2, ClipboardPaste, LoaderCircle, MailSearch, Save, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState } from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'
import { StatusMessage } from '../components/StatusMessage'
import { accountsChangedEvent, categoriesChangedEvent } from '../events/financeEvents'
import { bankMovementKindLabel, parseBankEmail } from '../lib/bankEmailParser'
import type { ParsedBankEmail } from '../lib/bankEmailParser'
import {
  authorizedBanks,
  fetchAuthorizedBankEmails,
  gmailConfigured,
  requestGmailAccessToken,
} from '../lib/gmailBankEmailClient'
import type { AuthorizedBankId, GmailBankEmail } from '../lib/gmailBankEmailClient'
import { listAccounts, listCategories, saveMovement } from '../services/accounting'
import type { Account, Category, MovementFormValues, MovementType, PaymentMethod } from '../types/finance'
import { formatMoney, movementTypeLabel, paymentMethodLabel } from '../utils/format'

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-500/20'

const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'

const initialEmailText = ''
const bankSelectionStorageKey = 'finance:gmail-authorized-banks'

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

function readInitialAuthorizedBanks() {
  const stored = window.localStorage.getItem(bankSelectionStorageKey)
  if (!stored) return authorizedBanks.map((bank) => bank.id)

  try {
    const parsed = JSON.parse(stored) as AuthorizedBankId[]
    const allowedIds = new Set(authorizedBanks.map((bank) => bank.id))
    const validIds = parsed.filter((bankId) => allowedIds.has(bankId))
    return validIds.length ? validIds : authorizedBanks.map((bank) => bank.id)
  } catch {
    return authorizedBanks.map((bank) => bank.id)
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
  const [gmailConnecting, setGmailConnecting] = useState(false)
  const [gmailLoading, setGmailLoading] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [authorizedBankIds, setAuthorizedBankIds] = useState<AuthorizedBankId[]>(readInitialAuthorizedBanks)
  const [gmailEmails, setGmailEmails] = useState<GmailBankEmail[]>([])
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

  useEffect(() => {
    window.localStorage.setItem(bankSelectionStorageKey, JSON.stringify(authorizedBankIds))
  }, [authorizedBankIds])

  function analyzeEmail() {
    setError('')
    setSuccess('')
    const nextParsed = parseBankEmail(emailText)
    setParsed(nextParsed)
    setValues(parsedToMovement(nextParsed, categories, accounts))
  }

  function toggleAuthorizedBank(bankId: AuthorizedBankId) {
    setAuthorizedBankIds((current) =>
      current.includes(bankId)
        ? current.filter((currentBankId) => currentBankId !== bankId)
        : [...current, bankId],
    )
  }

  async function connectGmail() {
    setError('')
    setSuccess('')
    setGmailConnecting(true)
    try {
      await requestGmailAccessToken()
      setGmailConnected(true)
      setSuccess('Gmail conectado con permiso de solo lectura.')
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'No se pudo conectar Gmail.')
    } finally {
      setGmailConnecting(false)
    }
  }

  async function loadGmailEmails() {
    setError('')
    setSuccess('')

    if (!authorizedBankIds.length) {
      setError('Selecciona al menos un banco autorizado antes de leer Gmail.')
      return
    }

    setGmailLoading(true)
    try {
      const emails = await fetchAuthorizedBankEmails({ selectedBankIds: authorizedBankIds, maxResults: 10 })
      setGmailConnected(true)
      setGmailEmails(emails)
      setSuccess(emails.length ? `${emails.length} correo(s) bancario(s) encontrados.` : 'No se encontraron correos de los bancos autorizados.')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron leer correos de Gmail.')
    } finally {
      setGmailLoading(false)
    }
  }

  function handleUseGmailEmail(email: GmailBankEmail) {
    const nextText = `${email.subject}\n${email.from}\n${email.date}\n${email.snippet}\n${email.body}`.trim()
    setEmailText(nextText)
    setParsed(email.parsed)
    setValues(parsedToMovement(email.parsed, categories, accounts))
    setSuccess('Correo cargado en la vista previa. Revisa los datos antes de guardar.')
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
              Tambien puedes conectar Gmail con permiso de solo lectura. Solo se consultan bancos que marques como autorizados.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <article className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Leer correos desde Gmail</h3>
              <p className="mt-1 text-sm text-muted dark:text-slate-400">
                Autoriza bancos especificos y consulta Gmail usando solo el scope `gmail.readonly`.
              </p>
            </div>
            <span
              className={clsx(
                'inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
                gmailConnected
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {gmailConnected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
              {gmailConnected ? 'Conectado' : 'No conectado'}
            </span>
          </div>

          {!gmailConfigured() ? (
            <div className="mt-4">
              <StatusMessage message="Configura VITE_GOOGLE_CLIENT_ID para activar Google OAuth en esta pantalla." />
            </div>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {loadingCatalogs ? (
              <SkeletonList rows={4} itemHeight="h-11" />
            ) : (
              authorizedBanks.map((bank) => (
                <label
                  key={bank.id}
                  className={clsx(
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition',
                    authorizedBankIds.includes(bank.id)
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
                      : 'border-line bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={authorizedBankIds.includes(bank.id)}
                    onChange={() => toggleAuthorizedBank(bank.id)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  {bank.name}
                </label>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!gmailConfigured() || gmailConnecting}
              onClick={() => void connectGmail()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 sm:flex-none"
            >
              {gmailConnecting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <MailSearch className="h-5 w-5" />}
              Conectar Gmail
            </button>
            <button
              type="button"
              disabled={!gmailConfigured() || gmailLoading || !authorizedBankIds.length}
              onClick={() => void loadGmailEmails()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            >
              {gmailLoading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              Buscar correos
            </button>
          </div>

          {gmailEmails.length ? (
            <div className="mt-5 divide-y divide-line overflow-hidden rounded-lg border border-line dark:divide-slate-800 dark:border-slate-800">
              {gmailEmails.map((email) => (
                <article key={email.id} className="p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{email.subject}</p>
                      <p className="mt-1 truncate text-sm text-muted dark:text-slate-400">{email.from}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{email.snippet}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUseGmailEmail(email)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:border-slate-700 dark:text-brand-100 dark:hover:bg-brand-500/10"
                    >
                      Usar correo
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </article>

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
                <PreviewItem label="Fecha" value={parsed.date || 'No detectada'} />
                <PreviewItem label="Hora" value={parsed.time || 'No detectada'} />
                <PreviewItem label="Comercio/beneficiario" value={parsed.merchant || parsed.beneficiary || 'No detectado'} />
                <PreviewItem label="Ultimos 4 digitos" value={parsed.last4 || 'No detectado'} />
                <PreviewItem label="Canal" value={parsed.channel || 'No detectado'} />
                <PreviewItem label="Descripcion limpia" value={parsed.description || 'No detectada'} />
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
