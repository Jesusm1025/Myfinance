import type { CurrencyCode } from '../utils/currency'

export type BankMovementKind = 'expense' | 'income' | 'transfer' | 'withdrawal' | 'payment'

export type ParsedBankEmail = {
  bank: string
  movementKind: BankMovementKind
  transactionType: 'income' | 'expense'
  amount: number | null
  currency: CurrencyCode | null
  merchant: string
  beneficiary: string
  description: string
  date: string
  time: string
  last4: string
  channel: string
  suggestedCategory: string
  confidence: number
  warnings: string[]
}

type ParsedDraft = Omit<ParsedBankEmail, 'confidence' | 'warnings'>

type BankDefinition = {
  bank: string
  patterns: RegExp[]
}

const unknownBank = 'Banco no identificado'

const banks: BankDefinition[] = [
  { bank: 'Banco Popular', patterns: [/banco\s+popular/i, /\bpopular\b/i, /popularenlinea/i] },
  { bank: 'Banreservas', patterns: [/banreservas/i, /banco\s+de\s+reservas/i] },
  { bank: 'BHD', patterns: [/\bbhd\b/i, /banco\s+bhd/i, /bhdleon/i] },
  { bank: 'Scotiabank', patterns: [/scotiabank/i, /\bscotia\b/i] },
]

const categoryRules = [
  { category: 'Comida', patterns: [/uber\s*eats|supermercado|market|colmado|restaurante|restaurant|cafe|pizza|burger|delivery/i] },
  { category: 'Transporte', patterns: [/uber(?!\s*eats)|taxi|combustible|gasolina|parqueo|metro|transporte/i] },
  { category: 'Servicios', patterns: [/apple\.com\/bill|energia|luz|agua|telefono|internet|claro|altice|edenorte|edesur|edeeste/i] },
  { category: 'Salud', patterns: [/farmacia|clinica|laboratorio|medico|salud/i] },
  { category: 'Educacion', patterns: [/colegio|universidad|curso|educacion|academia/i] },
  { category: 'Entretenimiento', patterns: [/cine|netflix|spotify|juego|entretenimiento|bar/i] },
  { category: 'Ropa', patterns: [/ropa|tienda|boutique|zapato|fashion/i] },
  { category: 'Deudas', patterns: [/prestamo|cuota|financiamiento|deuda/i] },
  { category: 'Salario', patterns: [/nomina|salario|sueldo|pago\s+de\s+nomina/i] },
  { category: 'Freelance', patterns: [/freelance|honorarios|servicio\s+profesional/i] },
  { category: 'Negocio', patterns: [/venta|negocio|comision/i] },
  { category: 'Regalo', patterns: [/regalo|bono|premio/i] },
]

const amountPatterns = [
  /(?:rd\$|dop|us\$|usd|eur|euro|bs|\$)\s*([0-9][0-9.,]*)/i,
  /(?:monto|valor|importe|cantidad|consumo|compra|retiro|pago|transferencia)[^\d]*(?:rd\$|dop|us\$|usd|eur|euro|bs|\$)?\s*([0-9][0-9.,]*)/i,
  /([0-9][0-9.,]*)\s*(?:rd\$|dop|us\$|usd|eur|euro|bs)/i,
]

const emailMonthMap: Record<string, string> = {
  jan: '01',
  january: '01',
  ene: '01',
  enero: '01',
  feb: '02',
  february: '02',
  febrero: '02',
  mar: '03',
  march: '03',
  marzo: '03',
  apr: '04',
  april: '04',
  abr: '04',
  abril: '04',
  may: '05',
  mayo: '05',
  jun: '06',
  june: '06',
  junio: '06',
  jul: '07',
  july: '07',
  julio: '07',
  aug: '08',
  august: '08',
  ago: '08',
  agosto: '08',
  sep: '09',
  sept: '09',
  september: '09',
  septiembre: '09',
  oct: '10',
  october: '10',
  octubre: '10',
  nov: '11',
  november: '11',
  noviembre: '11',
  dec: '12',
  december: '12',
  dic: '12',
  diciembre: '12',
}

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function stripHtml(text: string) {
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&aacute;|&#225;/gi, 'a')
    .replace(/&eacute;|&#233;/gi, 'e')
    .replace(/&iacute;|&#237;/gi, 'i')
    .replace(/&oacute;|&#243;/gi, 'o')
    .replace(/&uacute;|&#250;/gi, 'u')
    .replace(/&ntilde;|&#241;/gi, 'n')
    .replace(/&amp;/gi, '&')
}

function normalizeText(text: string) {
  return stripHtml(text)
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function comparableText(text: string) {
  return stripDiacritics(normalizeText(text)).toLowerCase()
}

function cleanEntity(value: string) {
  return normalizeText(value)
    .replace(/\s+/g, ' ')
    .replace(/\s+(aprobada|aprobado|declinada|declinado|rechazada|rechazado)\b.*$/i, '')
    .replace(/\s+(con|en)\s+su\s+tarjeta.*$/i, '')
    .replace(/\s+a\s+las\s+\d{1,2}:\d{2}.*$/i, '')
    .trim()
}

function detectBank(text: string) {
  return banks.find((bank) => bank.patterns.some((pattern) => pattern.test(text)))?.bank ?? unknownBank
}

function detectMovementKind(text: string): BankMovementKind {
  const cleanText = comparableText(text)
  if (/retiro|cajero|atm/.test(cleanText)) return 'withdrawal'
  if (/pago|pagaste|pago realizado|pago aplicado/.test(cleanText)) return 'payment'
  if (/transferencia|transferiste|recibiste una transferencia|transf\./.test(cleanText)) return 'transfer'
  if (/deposito|recibiste|acreditad[ao]|abono|nomina|salario/.test(cleanText)) return 'income'
  return 'expense'
}

function movementKindToTransactionType(kind: BankMovementKind, text: string): 'income' | 'expense' {
  const cleanText = comparableText(text)
  if (kind === 'income') return 'income'
  if (kind === 'transfer' && /recibiste|recibida|acreditad[ao]|abono/.test(cleanText)) return 'income'
  return 'expense'
}

function parseNumber(value: string) {
  const cleanValue = value.replace(/[^\d.,]/g, '')
  const lastComma = cleanValue.lastIndexOf(',')
  const lastDot = cleanValue.lastIndexOf('.')
  const decimalSeparator = lastComma > lastDot ? ',' : '.'
  const normalized = cleanValue
    .replace(new RegExp(`\\${decimalSeparator === ',' ? '.' : ','}`, 'g'), '')
    .replace(decimalSeparator, '.')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

function detectCurrency(text: string, bank: string): CurrencyCode | null {
  const cleanText = comparableText(text)
  if (/rd\$|dop|peso dominicano/.test(cleanText)) return 'DOP'
  if (/us\$|usd|dolar/.test(cleanText)) return 'USD'
  if (/€|eur|euro/.test(cleanText)) return 'EUR'
  if (/\bbs\b|bolivar/.test(cleanText)) return 'BOB'
  if (bank === 'Scotiabank' && /fuera del pais/.test(cleanText) && /\$\s*\d/.test(text)) return 'USD'
  return null
}

function extractAmount(text: string) {
  for (const pattern of amountPatterns) {
    const match = text.match(pattern)
    if (!match?.[1]) continue
    const amount = parseNumber(match[1])
    if (amount !== null) return amount
  }
  return null
}

function toIsoDate(day: string, month: string, year: string) {
  const fullYear = year.length === 2 ? `20${year}` : year
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function extractDate(text: string) {
  const isoMatch = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`

  const dateMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/)
  if (dateMatch) return toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3])

  const emailDateMatch = text.match(/\b(?:mon|tue|wed|thu|fri|sat|sun|lun|mar|mie|jue|vie|sab|dom),?\s+(\d{1,2})\s+([a-zA-Z]+)\s+(20\d{2})/i)
  if (emailDateMatch) {
    const month = emailMonthMap[emailDateMatch[2].toLowerCase()]
    if (month) return toIsoDate(emailDateMatch[1], month, emailDateMatch[3])
  }

  return new Date().toISOString().slice(0, 10)
}

function normalizeTime(hour: string, minute: string, meridiem?: string) {
  let numericHour = Number(hour)
  if (meridiem?.toLowerCase().startsWith('p') && numericHour < 12) numericHour += 12
  if (meridiem?.toLowerCase().startsWith('a') && numericHour === 12) numericHour = 0
  return `${String(numericHour).padStart(2, '0')}:${minute.padStart(2, '0')}`
}

function extractTime(text: string) {
  const transactionTime = text.match(/\b(?:a\s+las|hora)[:\s]+(\d{1,2}):(\d{2})\s*(am|pm)?/i)
  if (transactionTime) return normalizeTime(transactionTime[1], transactionTime[2], transactionTime[3])

  const emailTime = text.match(/\b\d{1,2}\s+[a-zA-Z]+\s+20\d{2}\s+(\d{1,2}):(\d{2})(?::\d{2})?\b/i)
  if (emailTime) return normalizeTime(emailTime[1], emailTime[2])

  return ''
}

function extractLast4(text: string) {
  return text.match(/\b(?:terminada|terminado|finalizada|finalizado|ending|tarjeta)[^\d]{0,20}(\d{4})\b/i)?.[1] ?? ''
}

function extractChannel(text: string) {
  const cleanText = comparableText(text)
  if (/visa debito|tarjeta de debito|debito/.test(cleanText)) return 'Tarjeta de debito'
  if (/visa credito|mastercard|tarjeta de credito|credito/.test(cleanText)) return 'Tarjeta de credito'
  if (/cajero|atm/.test(cleanText)) return 'Cajero automatico'
  if (/transferencia|popular en linea|scotia en linea|app|movil/.test(cleanText)) return 'Banca digital'
  return ''
}

function extractPopularMerchant(text: string) {
  const tableMatch = text.match(/RD\$\s*[0-9][0-9.,]*\s+Peso\s+dominicano\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+(.+?)\s+(?:Aprobada|Aprobado|Declinada|Rechazada)\b/i)
  if (tableMatch?.[1]) return cleanEntity(tableMatch[1])
  return ''
}

function extractScotiabankMerchant(text: string) {
  const match = text.match(/monto\s+de\s+\$?\s*[0-9][0-9.,]*\s+en\s+(.+?)\s+con\s+su\s+tarjeta/i)
  if (match?.[1]) return cleanEntity(match[1])
  return ''
}

function extractGenericMerchant(text: string) {
  const candidates = [
    /(?:comercio|establecimiento|beneficiario|desde|hacia|a favor de)[:\s-]+([A-Z0-9ÁÉÍÓÚÑ .,&'/*-]{3,90})/i,
    /(?:compra|consumo|pago|retiro|transferencia)[^\n.]*?(?:en|a)\s+([A-Z0-9ÁÉÍÓÚÑ .,&'/*-]{3,90})/i,
  ]

  for (const pattern of candidates) {
    const match = text.match(pattern)
    const value = match?.[1] ? cleanEntity(match[1]) : ''
    if (value) return value
  }
  return ''
}

function extractMerchant(text: string, bank: string) {
  if (bank === 'Banco Popular') return extractPopularMerchant(text) || extractGenericMerchant(text)
  if (bank === 'Scotiabank') return extractScotiabankMerchant(text) || extractGenericMerchant(text)
  return extractGenericMerchant(text)
}

function buildDescription({
  bank,
  movementKind,
  merchant,
  beneficiary,
  last4,
}: Pick<ParsedDraft, 'bank' | 'movementKind' | 'merchant' | 'beneficiary' | 'last4'>) {
  const target = merchant || beneficiary || bank
  const cardSuffix = last4 ? ` - tarjeta ${last4}` : ''
  return `${bankMovementKindLabel(movementKind)} - ${target}${cardSuffix}`.trim()
}

function suggestCategory(description: string, text: string, transactionType: 'income' | 'expense') {
  const searchableText = `${description}\n${text}`
  const match = categoryRules.find((rule) => rule.patterns.some((pattern) => pattern.test(searchableText)))
  if (match) return match.category
  return transactionType === 'income' ? 'Otros' : 'Otros'
}

function confidenceScore(result: ParsedDraft) {
  let score = 20
  if (result.bank !== unknownBank) score += 15
  if (result.amount !== null) score += 20
  if (result.currency) score += 10
  if (result.date) score += 10
  if (result.time) score += 5
  if (result.merchant || result.beneficiary) score += 15
  if (result.last4) score += 5
  return Math.min(score, 100)
}

function buildWarnings(result: ParsedDraft, text: string) {
  const warnings: string[] = []
  if (!text) warnings.push('Pega el texto de una notificacion bancaria para analizarlo.')
  if (result.bank === unknownBank) warnings.push('No se pudo identificar el banco con seguridad.')
  if (result.amount === null) warnings.push('No se pudo detectar un monto valido.')
  if (!result.currency) warnings.push('No se pudo detectar la moneda; revisa el valor antes de guardar.')
  if (!result.merchant && !result.beneficiary) warnings.push('No se pudo detectar comercio o beneficiario con seguridad.')
  return warnings
}

function parseSpecificBank(text: string, bank: string): Partial<ParsedDraft> {
  if (bank === 'Banco Popular') {
    return {
      merchant: extractPopularMerchant(text),
      channel: extractChannel(text),
    }
  }

  if (bank === 'Scotiabank') {
    return {
      merchant: extractScotiabankMerchant(text),
      channel: extractChannel(text),
    }
  }

  return {}
}

export function parseBankEmail(rawText: string): ParsedBankEmail {
  const text = normalizeText(rawText)
  const bank = detectBank(text)
  const movementKind = detectMovementKind(text)
  const transactionType = movementKindToTransactionType(movementKind, text)
  const bankSpecificData = parseSpecificBank(text, bank)
  const merchant = bankSpecificData.merchant || extractMerchant(text, bank)
  const beneficiary = bankSpecificData.beneficiary ?? ''

  const draft: ParsedDraft = {
    bank,
    movementKind,
    transactionType,
    amount: extractAmount(text),
    currency: detectCurrency(text, bank),
    merchant,
    beneficiary,
    description: '',
    date: extractDate(text),
    time: extractTime(text),
    last4: extractLast4(text),
    channel: bankSpecificData.channel || extractChannel(text),
    suggestedCategory: '',
  }

  draft.description = buildDescription(draft)
  draft.suggestedCategory = suggestCategory(draft.description, text, transactionType)

  return {
    ...draft,
    confidence: confidenceScore(draft),
    warnings: buildWarnings(draft, text),
  }
}

export function bankMovementKindLabel(kind: BankMovementKind) {
  const labels = {
    expense: 'Gasto',
    income: 'Ingreso',
    transfer: 'Transferencia',
    withdrawal: 'Retiro',
    payment: 'Pago',
  }
  return labels[kind]
}
