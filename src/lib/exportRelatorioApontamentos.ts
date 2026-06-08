import * as XLSX from 'xlsx'

export interface RelatorioRow {
  date_inclusion: string
  date_inclusion_late?: boolean  // digitado fora da competência (serviço no mês, lançado depois)
  requester: string
  consultant: string
  ticket: string
  title: string
  description: string
  start_time: string
  end_time: string
  effort_hours: string         // formato HH:MM para o PDF/preview
  effort_decimal: number       // decimal para o Excel (ex: 0.5, 1.5)
  date_service: string
}

export interface RelatorioMeta {
  client: string
  period: string
  emittedAt: string
  totalHours: string
  totalRecords: number
  ticketHeader?: string  // 'Ticket' (default) ou 'Ticket HD Think' (VEDAMOTORS)
  titleHeader?:  string  // 'Título' (default) ou 'Ticket Vedamotors' (VEDAMOTORS)
}

function buildCols(meta: RelatorioMeta): string[] {
  return [
    'Data de Inclusão', 'Solicitante', 'Consultor',
    meta.ticketHeader ?? 'Ticket',
    meta.titleHeader  ?? 'Título',
    'Descrição', 'Início', 'Fim', 'Esforço (h)', 'Data do Serviço',
  ]
}

function fmtFilename(meta: RelatorioMeta): string {
  const safe = meta.client.replace(/[^\w-]+/g, '_').slice(0, 40)
  return `relatorio-apontamentos_${safe}`
}

export function exportRelatorioToExcel(rows: RelatorioRow[], meta: RelatorioMeta) {
  const cols = buildCols(meta)
  const aoa: (string | number)[][] = [
    cols,
    ...rows.map(r => [
      // Marcador "⚠" destaca digitação fora da competência (SheetJS não suporta cor de célula).
      r.date_inclusion_late ? `⚠ ${r.date_inclusion}` : r.date_inclusion,
      r.requester, r.consultant, r.ticket, r.title,
      r.description, r.start_time, r.end_time, r.effort_decimal, r.date_service,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 10 },
    { wch: 30 }, { wch: 50 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 },
  ]

  // Formata coluna "Esforço (h)" (índice 8 = coluna I) como número decimal com 2 casas.
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let row = 1; row <= range.e.r; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 8 })
    const cell = ws[cellAddress]
    if (cell && typeof cell.v === 'number') {
      cell.t = 'n'
      cell.z = '0.00'
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Apontamentos')
  XLSX.writeFile(wb, `${fmtFilename(meta)}.xlsx`)
}
