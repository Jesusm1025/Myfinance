import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import writeXlsxFile, { type SheetData } from 'write-excel-file/browser'
import type { Movement } from '../types/finance'
import { formatDate, formatMoney, movementTypeLabel, paymentMethodLabel } from './format'
import type { CategoryReportRow, PaymentMethodReportRow, ReportSummary } from './reports'

type ExportPayload = {
  movements: Movement[]
  summary: ReportSummary
  categories: CategoryReportRow[]
  paymentMethods: PaymentMethodReportRow[]
  periodLabel: string
  fileSuffix: string
}

type ExcelRow = Record<string, string | number>

function downloadBlob(content: BlobPart, mimeType: string, fileName: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function movementRows(movements: Movement[]) {
  return movements.map((movement) => ({
    Fecha: formatDate(movement.date),
    Tipo: movementTypeLabel(movement.type),
    Categoria: movement.category?.name ?? 'Sin categoria',
    Descripcion: movement.description ?? '',
    Metodo: paymentMethodLabel(movement.payment_method),
    Monto: Number(movement.amount),
  }))
}

function summaryRows(payload: ExportPayload) {
  return [
    { Concepto: 'Periodo', Valor: payload.periodLabel },
    { Concepto: 'Ingresos', Valor: payload.summary.income },
    { Concepto: 'Gastos', Valor: payload.summary.expenses },
    { Concepto: 'Balance', Valor: payload.summary.balance },
    { Concepto: 'Movimientos', Valor: payload.summary.movementCount },
  ]
}

function worksheetData(name: string, rows: ExcelRow[]) {
  const safeRows = rows.length ? rows : [{ Estado: 'Sin datos' }]
  const headers = Object.keys(safeRows[0])

  return {
    sheet: name,
    data: [headers, ...safeRows.map((row) => headers.map((header) => row[header] ?? ''))] satisfies SheetData,
    columns: headers.map(() => ({ width: 18 })),
  }
}

export function exportMovementsToCsv(payload: ExportPayload) {
  const rows = movementRows(payload.movements)
  const headers = ['Fecha', 'Tipo', 'Categoria', 'Descripcion', 'Metodo', 'Monto']
  const csv = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(',')),
  ].join('\n')

  downloadBlob(`\uFEFF${csv}`, 'text/csv;charset=utf-8', `movimientos-${payload.fileSuffix}.csv`)
}

export async function exportReportToExcel(payload: ExportPayload) {
  const movementsSheet = worksheetData('Movimientos', movementRows(payload.movements))
  const summarySheet = worksheetData('Resumen', summaryRows(payload))
  const categoriesSheet = worksheetData(
    'Categorias',
    payload.categories.map((row) => ({
      Categoria: row.name,
      Ingresos: row.income,
      Gastos: row.expenses,
      Balance: row.balance,
      Movimientos: row.count,
    })),
  )
  const methodsSheet = worksheetData(
    'Metodos',
    payload.paymentMethods.map((row) => ({
      Metodo: row.name,
      Ingresos: row.income,
      Gastos: row.expenses,
      Balance: row.balance,
      Movimientos: row.count,
    })),
  )

  await writeXlsxFile([movementsSheet, summarySheet, categoriesSheet, methodsSheet]).toFile(
    `reporte-financiero-${payload.fileSuffix}.xlsx`,
  )
}

export function exportSummaryToPdf(payload: ExportPayload) {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text('Mi Contabilidad Personal', 14, 18)
  doc.setFontSize(12)
  doc.text(`Resumen financiero: ${payload.periodLabel}`, 14, 28)

  autoTable(doc, {
    startY: 36,
    head: [['Concepto', 'Valor']],
    body: [
      ['Ingresos', formatMoney(payload.summary.income)],
      ['Gastos', formatMoney(payload.summary.expenses)],
      ['Balance', formatMoney(payload.summary.balance)],
      ['Movimientos', String(payload.summary.movementCount)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [25, 140, 124] },
  })

  autoTable(doc, {
    startY: 78,
    head: [['Categoria', 'Ingresos', 'Gastos', 'Balance']],
    body: payload.categories.map((row) => [
      row.name,
      formatMoney(row.income),
      formatMoney(row.expenses),
      formatMoney(row.balance),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  })

  autoTable(doc, {
    startY: 138,
    head: [['Metodo', 'Ingresos', 'Gastos', 'Balance']],
    body: payload.paymentMethods.map((row) => [
      row.name,
      formatMoney(row.income),
      formatMoney(row.expenses),
      formatMoney(row.balance),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [71, 85, 105] },
  })

  autoTable(doc, {
    startY: 198,
    head: [['Fecha', 'Movimiento', 'Categoria', 'Monto']],
    body: payload.movements.slice(0, 15).map((movement) => [
      formatDate(movement.date),
      movement.description || movementTypeLabel(movement.type),
      movement.category?.name ?? 'Sin categoria',
      `${movement.type === 'income' ? '+' : '-'}${formatMoney(Number(movement.amount))}`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [238, 108, 77] },
  })

  doc.save(`resumen-financiero-${payload.fileSuffix}.pdf`)
}
