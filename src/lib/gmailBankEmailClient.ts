import { parseBankEmail } from './bankEmailParser'
import type { ParsedBankEmail } from './bankEmailParser'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

const gmailScope = 'https://www.googleapis.com/auth/gmail.readonly'
const googleIdentityScript = 'https://accounts.google.com/gsi/client'
const gmailApiBaseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me'

export type AuthorizedBankId = 'popular' | 'banreservas' | 'bhd' | 'scotiabank'

export type AuthorizedBank = {
  id: AuthorizedBankId
  name: string
  queryTerms: string[]
}

export type GmailBankEmail = {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  body: string
  parsed: ParsedBankEmail
}

type GoogleTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void
}

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>
}

type GmailHeader = {
  name: string
  value: string
}

type GmailMessagePart = {
  mimeType?: string
  filename?: string
  body?: {
    data?: string
    attachmentId?: string
  }
  parts?: GmailMessagePart[]
}

type GmailMessageResponse = {
  id: string
  threadId: string
  snippet?: string
  payload?: GmailMessagePart & {
    headers?: GmailHeader[]
  }
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string
            scope: string
            callback: (response: GoogleTokenResponse) => void
          }) => GoogleTokenClient
        }
      }
    }
  }
}

export const authorizedBanks: AuthorizedBank[] = [
  {
    id: 'popular',
    name: 'Banco Popular',
    queryTerms: ['"Banco Popular"', 'popular.com.do', 'bpd.com.do'],
  },
  {
    id: 'banreservas',
    name: 'Banreservas',
    queryTerms: ['Banreservas', '"Banco de Reservas"', 'banreservas.com.do'],
  },
  {
    id: 'bhd',
    name: 'BHD',
    queryTerms: ['BHD', 'bhd.com.do', 'bhdleon.com.do'],
  },
  {
    id: 'scotiabank',
    name: 'Scotiabank',
    queryTerms: ['Scotiabank', 'scotia', 'scotiabank.com.do'],
  },
]

let googleScriptPromise: Promise<void> | null = null
let accessToken: string | null = null

export function gmailConfigured() {
  return Boolean(googleClientId)
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${googleIdentityScript}"]`)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Google Identity Services.')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = googleIdentityScript
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services.'))
    document.head.appendChild(script)
  })

  return googleScriptPromise
}

export async function requestGmailAccessToken() {
  if (!googleClientId) {
    throw new Error('Configura VITE_GOOGLE_CLIENT_ID para conectar Gmail.')
  }

  await loadGoogleIdentityScript()

  return new Promise<string>((resolve, reject) => {
    const tokenClient = window.google?.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: gmailScope,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error))
          return
        }
        if (!response.access_token) {
          reject(new Error('Google no devolvio un access token valido.'))
          return
        }
        accessToken = response.access_token
        resolve(response.access_token)
      },
    })

    if (!tokenClient) {
      reject(new Error('No se pudo iniciar Google OAuth.'))
      return
    }

    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' })
  })
}

function buildGmailQuery(selectedBankIds: AuthorizedBankId[]) {
  const selectedBanks = authorizedBanks.filter((bank) => selectedBankIds.includes(bank.id))
  const terms = selectedBanks.flatMap((bank) => bank.queryTerms)
  const bankQuery = terms.length ? `(${terms.join(' OR ')})` : ''
  const transactionQuery = '(compra OR consumo OR pago OR retiro OR transferencia OR deposito OR depósito)'
  return [bankQuery, transactionQuery, 'newer_than:90d'].filter(Boolean).join(' ')
}

async function gmailFetch<T>(path: string, token: string) {
  const response = await fetch(`${gmailApiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Gmail respondio ${response.status}. Vuelve a conectar o revisa permisos.`)
  }

  return response.json() as Promise<T>
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

function extractBody(part?: GmailMessagePart): string {
  if (!part) return ''
  if (part.body?.data && (!part.mimeType || part.mimeType.startsWith('text/'))) {
    return decodeBase64Url(part.body.data)
  }

  const children = part.parts ?? []
  const plainText = children.find((child) => child.mimeType === 'text/plain')
  if (plainText?.body?.data) return decodeBase64Url(plainText.body.data)

  return children.map(extractBody).filter(Boolean).join('\n')
}

function headerValue(message: GmailMessageResponse, name: string) {
  return message.payload?.headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function bankIsAuthorized(parsed: ParsedBankEmail, body: string, selectedBankIds: AuthorizedBankId[]) {
  const bank = authorizedBanks.find((item) => selectedBankIds.includes(item.id) && parsed.bank === item.name)
  if (bank) return true
  return authorizedBanks
    .filter((item) => selectedBankIds.includes(item.id))
    .some((item) => item.queryTerms.some((term) => body.toLowerCase().includes(term.replaceAll('"', '').toLowerCase())))
}

export async function fetchAuthorizedBankEmails({
  selectedBankIds,
  maxResults = 10,
  token,
}: {
  selectedBankIds: AuthorizedBankId[]
  maxResults?: number
  token?: string
}) {
  const activeToken = token ?? accessToken ?? await requestGmailAccessToken()
  const query = encodeURIComponent(buildGmailQuery(selectedBankIds))
  const list = await gmailFetch<GmailListResponse>(`/messages?maxResults=${maxResults}&q=${query}`, activeToken)
  const messageRefs = list.messages ?? []

  const messages = await Promise.all(
    messageRefs.map((message) =>
      gmailFetch<GmailMessageResponse>(
        `/messages/${message.id}?format=full&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        activeToken,
      ),
    ),
  )

  return messages
    .map((message) => {
      const body = extractBody(message.payload)
      const parsed = parseBankEmail(`${headerValue(message, 'Subject')}\n${message.snippet ?? ''}\n${body}`)
      return {
        id: message.id,
        threadId: message.threadId,
        subject: headerValue(message, 'Subject') || 'Sin asunto',
        from: headerValue(message, 'From') || 'Remitente no disponible',
        date: headerValue(message, 'Date') || '',
        snippet: message.snippet ?? '',
        body,
        parsed,
      }
    })
    .filter((message) => bankIsAuthorized(message.parsed, `${message.from}\n${message.subject}\n${message.body}`, selectedBankIds))
}
