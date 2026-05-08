'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import {
  PageHeader, Card, Button,
  Table, Thead, Th, Tbody, Tr, Td,
  EmptyState, Skeleton,
} from '@/components/ds'
import { SearchSelect } from '@/components/ui/search-select'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { FileText, FileSpreadsheet, Search, Calendar } from 'lucide-react'
import {
  exportRelatorioToExcel, exportRelatorioToPDF,
  type RelatorioRow, type RelatorioMeta,
} from '@/lib/exportRelatorioApontamentos'

type PeriodMode = 'month' | 'range'

interface Customer { id: number; name: string }

interface RawTimesheet {
  date: string
  start_time?: string | null
  end_time?: string | null
  effort_hours?: string | null
  effort_minutes?: number | null
  ticket?: string | null
  ticket_subject?: string | null
  ticket_solicitante?: { name?: string; email?: string; organization?: string } | string | null
  observation?: string | null
  user?: { id: number; name: string } | null
  customer?: { id: number; name: string } | null
  project?: { id: number; name: string } | null
  status?: string
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const STATUS_OPTS = [
  { id: 'approved', name: 'Aprovados' },
  { id: '',         name: 'Todos' },
  { id: 'pending',  name: 'Pendentes' },
  { id: 'rejected', name: 'Rejeitados' },
]

function fmtDateBR(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtTimeHM(t: string | null | undefined): string {
  if (!t) return ''
  return t.length >= 5 ? t.slice(0, 5) : t
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function parseRequester(v: RawTimesheet['ticket_solicitante']): string {
  if (!v) return ''
  if (typeof v === 'string') {
    try { return (JSON.parse(v)?.name as string) ?? '' } catch { return '' }
  }
  return v.name ?? ''
}

export default function RelatorioApontamentosPage() {
  const today = new Date()

  const [customers,  setCustomers]  = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState<string | number>('')

  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const [status, setStatus] = useState<string>('approved')

  const [items,   setItems]   = useState<RawTimesheet[]>([])
  const [loaded,  setLoaded]  = useState(false)
  const [loading, setLoading] = useState(false)

  // ── Load customers
  useEffect(() => {
    api.get<any>('/customers?pageSize=2000')
      .then(r => {
        const list: any[] = Array.isArray(r) ? r : r?.items ?? r?.data ?? []
        setCustomers(list.map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(() => toast.error('Erro ao carregar clientes'))
  }, [])

  // ── Period helpers
  const periodInfo = useMemo(() => {
    if (periodMode === 'month') {
      const start = `${year}-${String(month).padStart(2, '0')}-01`
      const last  = new Date(year, month, 0).getDate()
      const end   = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
      return { start, end, label: `${MONTHS_PT[month - 1]} ${year}` }
    }
    return {
      start: dateFrom,
      end:   dateTo,
      label: dateFrom && dateTo ? `${fmtDateBR(dateFrom)} a ${fmtDateBR(dateTo)}` : '',
    }
  }, [periodMode, year, month, dateFrom, dateTo])

  const customerName = useMemo(
    () => customers.find(c => String(c.id) === String(customerId))?.name ?? '',
    [customers, customerId],
  )

  // ── Load report
  async function loadReport() {
    if (!customerId) { toast.error('Selecione um cliente'); return }
    if (!periodInfo.start || !periodInfo.end) { toast.error('Defina o período'); return }
    setLoading(true)
    try {
      const p = new URLSearchParams({
        customer_id: String(customerId),
        start_date:  periodInfo.start,
        end_date:    periodInfo.end,
        pageSize:    '2000',
      })
      if (status) p.set('status', status)
      const r = await api.get<any>(`/timesheets?${p}`)
      const list: RawTimesheet[] = Array.isArray(r?.items) ? r.items : []
      list.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1
        return (a.start_time ?? '').localeCompare(b.start_time ?? '')
      })
      setItems(list)
      setLoaded(true)
    } catch {
      toast.error('Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }

  // ── Total
  const totalMinutes = useMemo(
    () => items.reduce((acc, t) => acc + (t.effort_minutes ?? 0), 0),
    [items],
  )
  const totalHHMM = minutesToHHMM(totalMinutes)
  const emittedAt = fmtDateBR(today.toISOString().slice(0, 10))

  // ── Build export payload
  function buildRows(): RelatorioRow[] {
    return items.map(t => ({
      date:         fmtDateBR(t.date),
      requester:    parseRequester(t.ticket_solicitante),
      consultant:   t.user?.name ?? '',
      ticket:       t.ticket ?? '',
      title:        t.ticket_subject ?? '',
      description:  t.observation ?? '',
      start_time:   fmtTimeHM(t.start_time),
      end_time:     fmtTimeHM(t.end_time),
      effort_hours: t.effort_hours ?? minutesToHHMM(t.effort_minutes ?? 0),
    }))
  }

  function buildMeta(): RelatorioMeta {
    return {
      client:       customerName,
      period:       periodInfo.label,
      emittedAt,
      totalHours:   totalHHMM,
      totalRecords: items.length,
    }
  }

  function onExportExcel() {
    if (items.length === 0) { toast.error('Sem dados para exportar'); return }
    exportRelatorioToExcel(buildRows(), buildMeta())
  }

  function onExportPDF() {
    if (items.length === 0) { toast.error('Sem dados para exportar'); return }
    exportRelatorioToPDF(buildRows(), buildMeta())
  }

  // ── Render
  return (
    <AppLayout>
      <PageHeader
        icon={FileText}
        title="Relatório de Apontamentos"
        subtitle="Documento de cobrança e transparência por cliente — pronto para envio."
      />

      {/* Filtros */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>
              Cliente <span style={{ color: 'var(--brand-danger)' }}>*</span>
            </label>
            <SearchSelect
              value={customerId}
              onChange={v => setCustomerId(v)}
              options={customers}
              placeholder="Selecione um cliente"
              fullWidth
            />
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>
              Tipo de período
            </label>
            <div className="flex gap-2 h-9">
              <button
                type="button"
                onClick={() => setPeriodMode('month')}
                className="flex-1 rounded-lg text-xs px-3 transition-colors"
                style={{
                  background: periodMode === 'month' ? 'rgba(0,245,255,0.08)' : 'var(--brand-bg)',
                  border:     `1px solid ${periodMode === 'month' ? 'var(--brand-primary)' : 'var(--brand-border)'}`,
                  color:      periodMode === 'month' ? 'var(--brand-primary)' : 'var(--brand-muted)',
                }}
              >
                Mês fechado
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('range')}
                className="flex-1 rounded-lg text-xs px-3 transition-colors"
                style={{
                  background: periodMode === 'range' ? 'rgba(0,245,255,0.08)' : 'var(--brand-bg)',
                  border:     `1px solid ${periodMode === 'range' ? 'var(--brand-primary)' : 'var(--brand-border)'}`,
                  color:      periodMode === 'range' ? 'var(--brand-primary)' : 'var(--brand-muted)',
                }}
              >
                Intervalo
              </button>
            </div>
          </div>

          {periodMode === 'month' ? (
            <>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>Mês</label>
                <select
                  value={month}
                  onChange={e => setMonth(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg text-xs"
                  style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text)' }}
                >
                  {MONTHS_PT.map((label, i) => <option key={i} value={i + 1}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>Ano</label>
                <select
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg text-xs"
                  style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text)' }}
                >
                  {[today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>De</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-xs"
                  style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>Até</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-xs"
                  style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text)' }}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 justify-between">
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="h-9 px-3 rounded-lg text-xs min-w-40"
                style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand-text)' }}
              >
                {STATUS_OPTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Button variant="primary" icon={Search} loading={loading} onClick={loadReport} disabled={!customerId}>
              {loading ? 'Carregando...' : 'Gerar relatório'}
            </Button>
          </div>

          {loaded && items.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={FileSpreadsheet} onClick={onExportExcel}>Excel</Button>
              <Button variant="secondary" icon={FileText} onClick={onExportPDF}>PDF</Button>
            </div>
          )}
        </div>
      </Card>

      {/* Cabeçalho do relatório */}
      {loaded && (
        <Card className="mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--brand-subtle)' }}>
                Relatório de Apontamentos
              </div>
              <div className="text-lg font-bold" style={{ color: 'var(--brand-text)' }}>
                {customerName || '—'}
              </div>
            </div>
            <div className="text-right text-xs space-y-0.5" style={{ color: 'var(--brand-muted)' }}>
              <div className="flex items-center gap-1.5 justify-end">
                <Calendar size={12} />
                <span>Período: <span style={{ color: 'var(--brand-text)' }}>{periodInfo.label}</span></span>
              </div>
              <div>Emitido em: <span style={{ color: 'var(--brand-text)' }}>{emittedAt}</span></div>
              <div>
                Total: <span className="font-semibold" style={{ color: 'var(--brand-primary)' }}>{totalHHMM}</span>
                <span className="mx-2" style={{ color: 'var(--brand-subtle)' }}>•</span>
                <span style={{ color: 'var(--brand-text)' }}>{items.length}</span> registro{items.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tabela */}
      {loading && (
        <Card>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8" />)}
          </div>
        </Card>
      )}

      {!loading && loaded && items.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Nenhum apontamento encontrado"
          description="Ajuste os filtros e gere o relatório novamente."
        />
      )}

      {!loading && loaded && items.length > 0 && (
        <Card padding="none">
          <Table>
            <Thead>
              <tr>
                <Th>Data</Th>
                <Th>Solicitante</Th>
                <Th>Consultor</Th>
                <Th>Ticket</Th>
                <Th>Título</Th>
                <Th>Descrição</Th>
                <Th className="text-center">Início</Th>
                <Th className="text-center">Fim</Th>
                <Th right>Esforço</Th>
              </tr>
            </Thead>
            <Tbody>
              {items.map((t, i) => (
                <Tr key={i}>
                  <Td>{fmtDateBR(t.date)}</Td>
                  <Td>{parseRequester(t.ticket_solicitante)}</Td>
                  <Td>{t.user?.name ?? ''}</Td>
                  <Td>{t.ticket ?? ''}</Td>
                  <Td>{t.ticket_subject ?? ''}</Td>
                  <Td className="whitespace-pre-wrap max-w-[28rem]">{t.observation ?? ''}</Td>
                  <Td className="text-center">{fmtTimeHM(t.start_time)}</Td>
                  <Td className="text-center">{fmtTimeHM(t.end_time)}</Td>
                  <Td right className="font-semibold">{t.effort_hours ?? minutesToHHMM(t.effort_minutes ?? 0)}</Td>
                </Tr>
              ))}
              <tr style={{ background: 'var(--brand-bg)', borderTop: '2px solid var(--brand-border)' }}>
                <td
                  colSpan={8}
                  className="px-5 py-3.5 text-right font-bold"
                  style={{ color: 'var(--brand-text)' }}
                >
                  Total
                </td>
                <td
                  className="px-5 py-3.5 text-right font-bold"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  {totalHHMM}
                </td>
              </tr>
            </Tbody>
          </Table>
        </Card>
      )}
    </AppLayout>
  )
}
