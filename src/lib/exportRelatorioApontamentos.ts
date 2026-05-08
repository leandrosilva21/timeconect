import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface RelatorioRow {
  date: string
  requester: string
  consultant: string
  ticket: string
  title: string
  description: string
  start_time: string
  end_time: string
  effort_hours: string
}

export interface RelatorioMeta {
  client: string
  period: string
  emittedAt: string
  totalHours: string
  totalRecords: number
}

const COLS = [
  'Data', 'Solicitante', 'Consultor', 'Ticket', 'Título',
  'Descrição', 'Início', 'Fim', 'Esforço (h)',
]

function fmtFilename(meta: RelatorioMeta): string {
  const safe = meta.client.replace(/[^\w-]+/g, '_').slice(0, 40)
  return `relatorio-apontamentos_${safe}`
}

export function exportRelatorioToExcel(rows: RelatorioRow[], meta: RelatorioMeta) {
  const aoa: (string | number)[][] = [
    ['RELATÓRIO DE APONTAMENTOS'],
    ['Cliente:',     meta.client],
    ['Período:',     meta.period],
    ['Emitido em:',  meta.emittedAt],
    [],
    COLS,
    ...rows.map(r => [
      r.date, r.requester, r.consultant, r.ticket, r.title,
      r.description, r.start_time, r.end_time, r.effort_hours,
    ]),
    [],
    ['Total de horas:',     meta.totalHours],
    ['Total de registros:', meta.totalRecords],
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS.length - 1 } }]
  ws['!cols'] = [
    { wch: 12 }, { wch: 24 }, { wch: 22 }, { wch: 10 },
    { wch: 30 }, { wch: 50 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Apontamentos')
  XLSX.writeFile(wb, `${fmtFilename(meta)}.xlsx`)
}

export function exportRelatorioToPDF(rows: RelatorioRow[], meta: RelatorioMeta) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const margin = 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Relatório de Apontamentos', margin, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Cliente: ${meta.client}`,    margin, 24)
  doc.text(`Período: ${meta.period}`,    margin, 30)
  doc.text(`Emitido em: ${meta.emittedAt}`, margin, 36)

  autoTable(doc, {
    startY: 42,
    head: [COLS],
    body: rows.map(r => [
      r.date, r.requester, r.consultant, r.ticket, r.title,
      r.description, r.start_time, r.end_time, r.effort_hours,
    ]),
    styles:     { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [24, 24, 28], textColor: [0, 245, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    columnStyles: {
      0: { cellWidth: 20 },                   // Data
      1: { cellWidth: 35 },                   // Solicitante
      2: { cellWidth: 32 },                   // Consultor
      3: { cellWidth: 16 },                   // Ticket
      4: { cellWidth: 40 },                   // Título
      5: { cellWidth: 'auto', minCellWidth: 60 }, // Descrição (mais larga, quebra)
      6: { cellWidth: 14, halign: 'center' }, // Início
      7: { cellWidth: 14, halign: 'center' }, // Fim
      8: { cellWidth: 16, halign: 'right' },  // Esforço
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      const pageH  = doc.internal.pageSize.getHeight()
      const pageNo = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(`Página ${pageNo}`, doc.internal.pageSize.getWidth() - margin, pageH - 6, { align: 'right' })
    },
  })

  const finalY = (doc as any).lastAutoTable?.finalY ?? 60
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(0)
  doc.text(`Total de horas: ${meta.totalHours}`,        margin, finalY + 10)
  doc.text(`Total de registros: ${meta.totalRecords}`,  margin, finalY + 16)

  doc.save(`${fmtFilename(meta)}.pdf`)
}
