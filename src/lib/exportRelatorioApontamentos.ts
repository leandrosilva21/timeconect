import * as XLSX from 'xlsx'

export interface RelatorioRow {
  date_inclusion: string
  requester: string
  consultant: string
  ticket: string
  title: string
  description: string
  start_time: string
  end_time: string
  effort_hours: string
  date_service: string
}

export interface RelatorioMeta {
  client: string
  period: string
  emittedAt: string
  totalHours: string
  totalRecords: number
}

const COLS = [
  'Data de Inclusão', 'Solicitante', 'Consultor', 'Ticket', 'Título',
  'Descrição', 'Início', 'Fim', 'Esforço (h)', 'Data do Serviço',
]

function fmtFilename(meta: RelatorioMeta): string {
  const safe = meta.client.replace(/[^\w-]+/g, '_').slice(0, 40)
  return `relatorio-apontamentos_${safe}`
}

export function exportRelatorioToExcel(rows: RelatorioRow[], meta: RelatorioMeta) {
  const aoa: (string | number)[][] = [
    ['RELATÓRIO DE APONTAMENTOS'],
    ['Cliente:',     meta.client],
    ['Competência:', meta.period],
    ['Emitido em:',  meta.emittedAt],
    [],
    COLS,
    ...rows.map(r => [
      r.date_inclusion, r.requester, r.consultant, r.ticket, r.title,
      r.description, r.start_time, r.end_time, r.effort_hours, r.date_service,
    ]),
    [],
    ['Total de horas:',     meta.totalHours],
    ['Total de registros:', meta.totalRecords],
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS.length - 1 } }]
  ws['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 10 },
    { wch: 30 }, { wch: 50 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Apontamentos')
  XLSX.writeFile(wb, `${fmtFilename(meta)}.xlsx`)
}
