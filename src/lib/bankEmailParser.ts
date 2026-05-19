import type { CurrencyCode } from '../utils/currency'

export type BankMovementKind = 'expense' | 'income' | 'transfer' | 'withdrawal' | 'payment'

export type ParsedBankEmail = {
  bank: string
  movementKind: BankMovementKind
  transactionType: 'income' | 'expense'
  amount: number | null
  currency: CurrencyCode | null
  description: string
  date: string
  suggestedCategory: string
  confidence: number
  warnings: string[]
}

type BankDefinition = {
  bank: string
  patterns: RegExp[]
}

const banks: BankDefinition[] = [
  { bank: 'Banco Popular', patterns: [/banco\s+popular/i, /\bpopular\b/i] },
  { bank: 'Banreservas', patterns: [/banreservas/i, /banco\s+de\s+reservas/i] },
  { bank: 'BHD', patterns: [/\bbhd\b/i, /banco\s+bhd/i] },
  { bank: 'Scotiabank', patterns: [/scotiabank/i, /scotia/i] },
]

const categoryRules = [
  { category: 'Comida', patterns: [/supermercado|market|colmado|restaurante|restaurant|cafe|pizza|burger|delivery/i] },
  { category: 'Transporte', patterns: [/uber|taxi|combustible|gasolina|parqueo|metro|transporte/i] },
  { category: 'Servicios', patterns: [/energia|luz|agua|telefono|internet|claro|altice|edenorte|edesur|edeeste/i] },
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
  /(?:rd\$|dop|dólares?|usd|us\$|eur|€|bs)\s*([0-9][0-9.,]*)/i,
  /(?:monto|valor|importe|cantidad|consumo|compra|retiro|pago|transferencia)[^\d]*(?:rd\$|dop|usd|us\$|eur|€|bs)?\s*([0-9][0-9.,]*)/i,
  /([0-9][0-9.,]*)\s*(?:rd\$|dop|usd|us\$|eur|€|bs)/i,
]

function normalizeText(text: string) {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function detectBank(text: string) {
  return banks.find((bank) => bank.patterns.some((pattern) => pattern.test(text)))?.bank ?? 'Banco no identificado'
}

function detectMovementKind(text: string): BankMovementKind {
  if (/retiro|cajero|atm/i.test(text)) return 'withdrawal'
  if (/pago|pagaste|pago\s+realizado|pago\s+aplicado/i.test(text)) return 'payment'
  if (/transferencia|transferiste|recibiste\s+una\s+transferencia|transf\./i.test(text)) return 'transfer'
  if (/deposito|depósito|recibiste|acreditad[ao]|abono|nomina|nómina|salario/i.test(text)) return 'income'
  return 'expense'
}

function movementKindToTransactionType(kind: BankMovementKind, text: string): 'income' | 'expense' {
  if (kind === 'income') return 'income'
  if (kind === 'transfer' && /recibiste|recibida|acreditad[ao]|abono/i.test(text)) return 'income'
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

function detectCurrency(text: string): CurrencyCode | null {
  if (/rd\$|dop|peso\s+dominicano/i.test(text)) return 'DOP'
  if (/us\$|usd|d[oó]lar/i.test(text)) return 'USD'
  if (/€|eur|euro/i.test(text)) return 'EUR'
  if (/\bbs\b|bol[ií]var/i.test(text)) return 'BOB'
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

  return new Date().toISOString().slice(0, 10)
}

function extractDescription(text: string, bank: string) {
  const candidates = [
    /(?:en|comercio|establecimiento|beneficiario|desde|hacia|a favor de|descripcion|descripción)[:\s-]+([A-Z0-9ÁÉÍÓÚÑ .,&'/-]{3,80})/i,
    /(?:compra|consumo|pago|retiro|transferencia)[^\n.]*?(?:en|a)\s+([A-Z0-9ÁÉÍÓÚÑ .,&'/-]{3,80})/i,
  ]

  for (const pattern of candidates) {
    const match = text.match(pattern)
    const value = match?.[1]?.replace(/\s+(por|de|el|fecha|monto).*$/i, '').trim()
    if (value) return value
  }

  const firstUsefulLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 8 && !banks.some((item) => item.patterns.some((pattern) => pattern.test(line))))

  return firstUsefulLine ?? bank
}

function suggestCategory(description: string, text: string, transactionType: 'income' | 'expense') {
  const searchableText = `${description}\n${text}`
  const match = categoryRules.find((rule) => rule.patterns.some((pattern) => pattern.test(searchableText)))
  if (match) return match.category
  return transactionType === 'income' ? 'Otros' : 'Otros'
}

function confidenceScore(result: Omit<ParsedBankEmail, 'confidence'>) {
  let score = 30
  if (result.bank !== 'Banco no identificado') score += 20
  if (result.amount !== null) score += 25
  if (result.currency) score += 10
  if (result.description) score += 10
  if (result.date) score += 5
  return Math.min(score, 100)
}

export function parseBankEmail(rawText: string): ParsedBankEmail {
  const text = normalizeText(rawText)
  const bank = detectBank(text)
  const movementKind = detectMovementKind(text)
  const transactionType = movementKindToTransactionType(movementKind, text)
  const amount = extractAmount(text)
  const currency = detectCurrency(text)
  const description = extractDescription(text, bank)
  const date = extractDate(text)
  const suggestedCategory = suggestCategory(description, text, transactionType)
  const warnings: string[] = []

  if (!text) warnings.push('Pega el texto de una notificacion bancaria para analizarlo.')
  if (bank === 'Banco no identificado') warnings.push('No se pudo identificar el banco con seguridad.')
  if (amount === null) warnings.push('No se pudo detectar un monto valido.')
  if (!currency) warnings.push('No se pudo detectar la moneda; revisa el valor antes de guardar.')

  const result = {
    bank,
    movementKind,
    transactionType,
    amount,
    currency,
    description,
    date,
    suggestedCategory,
    warnings,
  }

  return {
    ...result,
    confidence: confidenceScore(result),
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
