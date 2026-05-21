'use client'

import { formatBRL } from '@/lib/format'
import { previewText } from '@/lib/sanitize'
import React, { useEffect, useState, useCallback } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { Zap, Clock, DollarSign, Download, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { KpiCard } from '@/components/ui/kpi-card'
import {
  DataTable, DataTableHead, DataTableHeadRow, DataTableHeadCell,
  DataTableBody, DataTableRow, DataTableCell, DataTableEmpty,
  StatusBadge, getStatusVariant,
} from '@/components/ui/ds'
import * as XLSX from 'xlsx'
import DashboardIndicators from '@/components/dashboard/DashboardIndicators'
import {
  useMaintenanceInline, exportMaintenanceToXLSX,
  ExportButton as MxExportButton,
  InlineTimesheetsTable as MxTimesheets,
  InlineTicketSummaryTable as MxTicketSummary,
  InlineExpensesTable as MxExpenses,
  TimesheetDetailModal,
} from '@/components/dashboard/MaintenanceInline'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { MonthYearPicker } from '@/components/ui/month-year-picker'
import { SearchSelect } from '@/components/ui/search-select'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Customer  { id: number; name: string }
interface Project   { id: number; name: string; code: string; status?: string; status_display?: string }
interface Executive { id: number; name: string }

interface SummaryData {
  consumed_hours: number
  month_consumed_hours: number
  amount_to_pay?: number | null
  hourly_rate?: number | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtH(h: number | null | undefined) { return (h ?? 0).toFixed(1) }
function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return formatBRL(v ?? 0)
}

// ─── Components ──────────────────────────────────────────────────────────────


function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-all"
      style={active ? { background: 'var(--brand-primary)', color: 'var(--primary-fg)' } : { color: 'var(--brand-muted)' }}
    >
      {label}
    </button>
  )
}

// MetricCard local removido — agora usamos KpiCard de '@/components/ui/kpi-card'.

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-6 animate-pulse" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
      <div className="h-3 w-24 rounded mb-4" style={{ background: 'var(--brand-border)' }} />
      <div className="h-10 w-20 rounded" style={{ background: 'var(--brand-border)' }} />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnDemandPage() {
  const { user } = useAuth()
  const router = useRouter()
  const isAdmin   = user?.type === 'admin'
  const isCliente = user?.type === 'cliente'
  const canReverseApproval = !!user && user.type !== 'consultor' && user.type !== 'cliente'

  useEffect(() => {
    if (user && user.type === 'coordenador') router.replace('/timesheets')
  }, [user, router])

  const now = new Date()
  const isoFirstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const isoLastDay  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`
  const [customers,   setCustomers]   = useState<Customer[]>([])
  const [executives,  setExecutives]  = useState<Executive[]>([])
  const [projects,    setProjects]    = useState<Project[]>([])
  const [selectedCustomer,  setSelectedCustomer]  = useState<number | ''>('')
  const [selectedExecutive, setSelectedExecutive] = useState<number | ''>('')
  const [selectedProject,   setSelectedProject]   = useState<number | ''>('')
  const [dateFrom, setDateFrom] = useState(isoFirstDay)
  const [dateTo,   setDateTo]   = useState(isoLastDay)
  const [refMonth, setRefMonth] = useState<number | null>(now.getMonth() + 1)
  const [refYear,  setRefYear]  = useState<number | null>(now.getFullYear())
  const [filterMode, setFilterMode] = useState<'month' | 'period'>('month')

  const [summary,       setSummary]       = useState<SummaryData | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'maintenance' | 'expenses' | 'indicators'>('overview')

  // Componentes embarcados (Sustentação + Despesas) — reusam endpoints do BH Fixo
  const mxKind: 'maintenance' | 'expenses' = activeTab === 'expenses' ? 'expenses' : 'maintenance'
  const { rows: mxRows, loading: mxLoading, ticketSummary: mxTicketSummary, ticketLoading: mxTicketLoading, reload: reloadMx } = useMaintenanceInline({
    enabled: activeTab === 'maintenance' || activeTab === 'expenses',
    kind: mxKind,
    customerId: (selectedCustomer as number) || user?.customer_id,
    projectId: (selectedProject as number) || null,
    dateFrom,
    dateTo,
  })
  const [mxDetail, setMxDetail] = useState<any | null>(null)
  const [indicatorParams, setIndicatorParams] = useState<URLSearchParams>(new URLSearchParams())
  const [inlineRows, setInlineRows] = useState<any[]>([])
  const [inlineLoading, setInlineLoading] = useState(false)
  const [inlineReloadKey, setInlineReloadKey] = useState(0)
  const reloadInline = () => setInlineReloadKey(k => k + 1)
  const [ticketSummary, setTicketSummary] = useState<Array<{ticket: string; title: string|null; requester: string|null; period_minutes: number; lifetime_minutes: number}>>([])
  const [ticketSummaryLoading, setTicketSummaryLoading] = useState(false)

  // Load customers & executives (admin only)
  useEffect(() => {
    if (!isAdmin) return
    api.get<any>('/customers?pageSize=100&has_contract_type_name=On+Demand')
      .then(r => setCustomers(Array.isArray(r?.items) ? r.items : [])).catch(() => {})
    api.get<any>('/executives?pageSize=100')
      .then(r => setExecutives(Array.isArray(r?.items) ? r.items : [])).catch(() => {})
  }, [isAdmin])

  // Load projects filtered by customer + contract type
  useEffect(() => {
    if (!user) return  // aguarda autenticação antes de buscar projetos
    const params = new URLSearchParams({ pageSize: '1000', contract_type_code: 'on_demand', parent_projects_only: 'true' })
    if (selectedCustomer) params.set('customer_id', String(selectedCustomer))
    else if (isCliente && user.customer_id) params.set('customer_id', String(user.customer_id))
    api.get<any>(`/projects?${params}`)
      .then(r => setProjects(Array.isArray(r?.items) ? r.items : [])).catch(() => {})
  }, [user, selectedCustomer, isCliente])

  const buildParams = useCallback(() => {
    const now = new Date()
    const toM = refMonth ?? (dateTo ? Number(dateTo.split('-')[1]) : now.getMonth() + 1)
    const toY = refYear  ?? (dateTo ? Number(dateTo.split('-')[0]) : now.getFullYear())
    const p = new URLSearchParams({ month: String(toM), year: String(toY) })
    if (dateFrom) {
      const [fromY, fromM] = dateFrom.split('-').map(Number)
      if (fromM !== toM || fromY !== toY) {
        p.set('start_month', String(fromM))
        p.set('start_year',  String(fromY))
      }
    }
    if (selectedCustomer)                    p.set('customer_id',  String(selectedCustomer))
    else if (isCliente && user?.customer_id) p.set('customer_id',  String(user.customer_id))
    if (selectedExecutive) p.set('executive_id', String(selectedExecutive))
    if (selectedProject)   p.set('project_id',   String(selectedProject))
    return p
  }, [selectedCustomer, selectedExecutive, selectedProject, dateFrom, dateTo, refMonth, refYear, isCliente, user?.customer_id])

  const fetchSummary = useCallback(() => {
    // Sem projeto selecionado NÃO traz nada (nem pro cliente) — antes agregava todos os
    // projetos do cliente, mostrando consumo + apontamentos que já migraram pra outro projeto.
    if (!selectedProject) { setSummary(null); return }
    setLoadingSummary(true)
    api.get<any>(`/dashboards/on-demand?${buildParams()}`)
      .then(r => setSummary(r?.data ?? r ?? null))
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false))
  }, [buildParams, isAdmin, refMonth, refYear])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  // Atualiza params para o componente de indicadores sempre que buildParams mudar
  useEffect(() => {
    setIndicatorParams(buildParams())
  }, [buildParams])

  // Legenda do "Consumo do Mês" — espelha o período efetivo do summary.
  const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const monthConsumptionHint = (() => {
    if (dateFrom && dateTo) {
      const fmt = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? `${m[3]}/${m[2]}/${m[1]}` : s }
      return `Período: ${fmt(dateFrom)} a ${fmt(dateTo)}`
    }
    if (refMonth && refYear) return `${MONTH_NAMES_PT[refMonth - 1]} ${refYear}`
    const now = new Date()
    return `Mês vigente — ${MONTH_NAMES_PT[now.getMonth()]} ${now.getFullYear()}`
  })()

  // Exige projeto selecionado pra TODOS (cliente incluído) — sem projeto = estado vazio,
  // não agrega/mostra dados de outros projetos.
  const hasFilters = !!selectedProject

  // Lista inline de apontamentos do projeto + ticket summary (mesmo padrão do BH Fixo/Sustentação)
  useEffect(() => {
    if (!hasFilters || !selectedProject || activeTab !== 'overview') { setInlineRows([]); setTicketSummary([]); return }
    setInlineLoading(true)
    setTicketSummaryLoading(true)
    const qs = new URLSearchParams()
    qs.set('project_id', String(selectedProject))
    if (selectedCustomer) qs.set('customer_id', String(selectedCustomer))
    else if (user?.customer_id) qs.set('customer_id', String(user.customer_id))
    if (dateFrom) qs.set('date_from', dateFrom)
    if (dateTo)   qs.set('date_to',   dateTo)
    api.get<{ data: any[] }>(`/dashboards/bank-hours-fixed/project-timesheets?${qs}`)
      .then(r => setInlineRows(r.data ?? []))
      .catch(() => setInlineRows([]))
      .finally(() => setInlineLoading(false))
    api.get<{ tickets: any[] }>(`/dashboards/bank-hours-fixed/project-ticket-summary?${qs}`)
      .then(r => setTicketSummary(r.tickets ?? []))
      .catch(() => setTicketSummary([]))
      .finally(() => setTicketSummaryLoading(false))
  }, [hasFilters, selectedProject, selectedCustomer, dateFrom, dateTo, user?.customer_id, activeTab, inlineReloadKey])

  function exportInlineToXLSX() {
    if (inlineRows.length === 0) return
    const data = inlineRows.map(r => ({
      Data: r.date ? r.date.split('-').reverse().join('/') : '',
      Consultor: r.user?.name ?? '',
      Código: r.project?.code ?? '',
      Projeto: r.project?.name ?? '',
      Ticket: r.ticket ?? '',
      'Assunto Ticket': r.ticket_subject ?? '',
      Descrição: previewText(r.description),
      Horas: Number(((r.effort_minutes ?? 0) / 60).toFixed(2)),
      Status: r.status_display ?? r.status ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'On Demand')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `on-demand_${stamp}.xlsx`)
  }



  return (
    <AppLayout title="Dashboard — On Demand">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page header */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,245,255,0.08)' }}>
            <Zap size={16} color="#00F5FF" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--brand-text)' }}>On Demand</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--brand-muted)' }}>Consumo de horas por demanda — visão por projeto e período</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 p-5 rounded-2xl" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
          {isAdmin && (
            <SearchSelect
              label="Executivo"
              value={String(selectedExecutive)}
              onChange={v => { setSelectedExecutive(v === '' ? '' : Number(v)); setSelectedCustomer(''); setSelectedProject('') }}
              options={executives}
              placeholder="Todos os executivos"
              wide
            />
          )}
          {isAdmin && (
            <SearchSelect
              label="Cliente"
              value={String(selectedCustomer)}
              onChange={v => { setSelectedCustomer(v === '' ? '' : Number(v)); setSelectedExecutive(''); setSelectedProject('') }}
              options={customers}
              placeholder="Todos os clientes"
              wide
            />
          )}
          <SearchSelect
            label="Projeto"
            value={String(selectedProject)}
            onChange={v => setSelectedProject(v === '' ? '' : Number(v))}
            options={projects.map(p => ({ id: p.id, name: `${p.code} — ${p.name}` }))}
            placeholder="Selecione um projeto"
            wide
          />
          {/* Status do projeto selecionado — em evidência pro cliente (Encerrado/Cancelado/etc.) */}
          {(() => {
            const sel = projects.find(p => p.id === selectedProject)
            if (!sel?.status) return null
            const variant = sel.status === 'cancelled' ? 'danger'
              : sel.status === 'finished' ? 'neutral'
              : sel.status === 'paused' ? 'warning'
              : (sel.status === 'started' || sel.status === 'awaiting_start') ? 'success'
              : 'info'
            return (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-subtle)' }}>Status</label>
                <div className="flex items-center" style={{ minHeight: 34 }}>
                  <StatusBadge variant={variant} size="md">{sel.status_display ?? sel.status}</StatusBadge>
                </div>
              </div>
            )
          })()}
          {/* Filtro de data */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-subtle)' }}>Data</label>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-xs">
                {(['month', 'period'] as const).map((mode) => (
                  <button key={mode} onClick={() => setFilterMode(mode)}
                    className="px-3 py-1.5 font-medium transition-colors"
                    style={{ background: filterMode === mode ? 'var(--primary)' : 'transparent', color: filterMode === mode ? 'var(--primary-fg)' : 'var(--text-muted)' }}>
                    {mode === 'month' ? 'Mês/Ano' : 'Período'}
                  </button>
                ))}
              </div>
              {filterMode === 'month' ? (
                <MonthYearPicker
                  month={refMonth}
                  year={refYear}
                  onChange={(m, y) => {
                    if (m === 0) { setRefMonth(null); setRefYear(null) }
                    else { setRefMonth(m); setRefYear(y); setDateFrom(''); setDateTo('') }
                  }}
                />
              ) : (
                <DateRangePicker
                  from={dateFrom}
                  to={dateTo}
                  onChange={(f, t) => { setDateFrom(f); setDateTo(t); setRefMonth(null); setRefYear(null) }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Empty state */}
        {!hasFilters && (
          <div className="rounded-2xl p-16 flex flex-col items-center gap-4 text-center" style={{ border: '1px dashed var(--brand-border)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,245,255,0.08)' }}>
              <Zap size={22} color="#00F5FF" />
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: 'var(--brand-text)' }}>Nenhum projeto selecionado</p>
              <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
                {isAdmin ? 'Selecione um cliente e um projeto para carregar os dados.' : 'Selecione um projeto para visualizar os dados de consumo.'}
              </p>
            </div>
          </div>
        )}

        {hasFilters && (
          <div className="space-y-6">
            {/* Tab bar */}
            <div className="flex gap-1 p-1 rounded-2xl w-fit" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
              <Tab label="Visão Geral"  active={activeTab === 'overview'}    onClick={() => setActiveTab('overview')} />
              <Tab label="Sustentação"  active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} />
              <Tab label="Despesas"     active={activeTab === 'expenses'}    onClick={() => setActiveTab('expenses')} />
              <Tab label="Indicadores"  active={activeTab === 'indicators'}  onClick={() => setActiveTab('indicators')} />
            </div>

            {/* ── VISÃO GERAL ── */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {loadingSummary ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                ) : summary ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiCard
                      label="Consumo do Mês"
                      value={fmtH(summary.month_consumed_hours)}
                      unit="h"
                      icon={Clock}
                      accent="primary"
                      hint={monthConsumptionHint}
                    />
                    <KpiCard
                      label="Valor Hora"
                      value={fmtBRL(summary.hourly_rate)}
                      icon={DollarSign}
                      accent="default"
                    />
                    <KpiCard
                      label="Valor a Pagar"
                      value={fmtBRL(summary.amount_to_pay)}
                      icon={DollarSign}
                      accent={(summary.amount_to_pay ?? 0) > 0 ? 'danger' : 'success'}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
                    <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>Nenhum dado disponível para o período selecionado.</p>
                  </div>
                )}

                {/* Exportar + Lista de apontamentos + Apuração por Ticket */}
                <ExportButton onClick={exportInlineToXLSX} disabled={inlineRows.length === 0} />
                <InlineTimesheetsTable rows={inlineRows} loading={inlineLoading} onReverseApproved={canReverseApproval} onReverseSuccess={reloadInline} />
                <InlineTicketSummaryTable rows={ticketSummary} loading={ticketSummaryLoading} />
              </div>
            )}

            {/* ── SUSTENTAÇÃO ── */}
            {activeTab === 'maintenance' && (
              <div className="space-y-4">
                <MxExportButton onClick={() => exportMaintenanceToXLSX('maintenance', mxRows)} disabled={mxRows.length === 0} />
                <MxTimesheets rows={mxRows} loading={mxLoading} variant="maintenance" onRowClick={setMxDetail} onReverseApproved={canReverseApproval} onReverseSuccess={reloadMx} />
                <MxTicketSummary rows={mxTicketSummary} loading={mxTicketLoading} />
              </div>
            )}

            {/* ── DESPESAS ── */}
            {activeTab === 'expenses' && (() => {
              const totalAmount = mxRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
              const toPay = mxRows
                .filter(r => !['rejected','rejeitado','pago','paid'].includes(String(r.status ?? '').toLowerCase()))
                .reduce((s, r) => s + (Number(r.amount) || 0), 0)
              const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiCard label="Quantidade"    value={String(mxRows.length)} icon={DollarSign} />
                    <KpiCard label="Valor Total"   value={fmtBRL(totalAmount)} icon={DollarSign} />
                    <KpiCard label="Valor a Pagar" value={fmtBRL(toPay)} icon={DollarSign} accent="primary" />
                  </div>
                  <MxExportButton onClick={() => exportMaintenanceToXLSX('expenses', mxRows)} disabled={mxRows.length === 0} />
                  <MxExpenses rows={mxRows} loading={mxLoading} />
                </div>
              )
            })()}

            {/* ── INDICADORES ── */}
            {activeTab === 'indicators' && (
              <DashboardIndicators
                basePath="/dashboards/on-demand/indicators"
                params={indicatorParams}
                disabled={!hasFilters}
              />
            )}
          </div>
        )}
      </div>
      {mxDetail && <TimesheetDetailModal ts={mxDetail} onClose={() => setMxDetail(null)} />}
    </AppLayout>
  )
}

// ─── Inline tables (mesmo padrão de /dashboards/bank-hours-fixed) ────────────

function InlineTimesheetsTable({ rows, loading, onReverseApproved, onReverseSuccess }: {
  rows: any[]; loading: boolean
  onReverseApproved?: boolean
  onReverseSuccess?: () => void
}) {
  const [reversingId, setReversingId] = useState<number | null>(null)
  const handleReverse = async (id: number) => {
    if (!confirm('Estornar a aprovação deste apontamento?')) return
    setReversingId(id)
    try {
      await api.post(`/timesheets/${id}/reverse-approval`, {})
      toast.success('Aprovação estornada')
      onReverseSuccess?.()
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao estornar aprovação')
    } finally {
      setReversingId(null)
    }
  }
  // POC do Design System: tabela canônica via <DataTable> + <StatusBadge>.
  // Zero CSS local; todos os estilos vêm dos tokens via componentes do DS.
  const colSpan = onReverseApproved ? 8 : 7
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="ds-text-h2" style={{ color: 'var(--text)' }}>Apontamentos do período</h3>
        <span className="ds-text-caption" style={{ color: 'var(--text-muted)' }}>{rows.length} registros</span>
      </div>
      <DataTable inline>
        <DataTableHead>
          <DataTableHeadRow>
            <DataTableHeadCell>Data</DataTableHeadCell>
            <DataTableHeadCell>Consultor</DataTableHeadCell>
            <DataTableHeadCell>Projeto</DataTableHeadCell>
            <DataTableHeadCell>Ticket</DataTableHeadCell>
            <DataTableHeadCell>Descrição</DataTableHeadCell>
            <DataTableHeadCell align="right">Horas</DataTableHeadCell>
            <DataTableHeadCell>Status</DataTableHeadCell>
            {onReverseApproved && <DataTableHeadCell align="right" />}
          </DataTableHeadRow>
        </DataTableHead>
        <DataTableBody>
          {loading ? (
            <DataTableEmpty colSpan={colSpan} message="Carregando…" />
          ) : rows.length === 0 ? (
            <DataTableEmpty colSpan={colSpan} message="Sem apontamentos no período selecionado." />
          ) : rows.map(r => {
            const canReverse = onReverseApproved && String(r.status ?? '').toLowerCase() === 'approved'
            return (
              <DataTableRow key={r.id}>
                <DataTableCell>{r.date ? r.date.split('-').reverse().join('/') : '—'}</DataTableCell>
                <DataTableCell muted={false}>{r.user?.name ?? '—'}</DataTableCell>
                <DataTableCell>
                  <span className="font-mono text-xs" style={{ color: 'var(--text-light)' }}>{r.project?.code}</span>
                  <span className="mx-1.5" style={{ color: 'var(--text-light)' }}>·</span>
                  <span style={{ color: 'var(--text)' }}>{r.project?.name}</span>
                </DataTableCell>
                <DataTableCell>
                  {r.ticket
                    ? <a href={`https://erpserv.movidesk.com/Ticket/Edit/${r.ticket}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs hover:underline" style={{ color: 'var(--primary)' }} onClick={(e) => e.stopPropagation()}>#{r.ticket}</a>
                    : <span style={{ color: 'var(--text-light)' }}>—</span>}
                </DataTableCell>
                <DataTableCell wrap>{previewText(r.description) || '—'}</DataTableCell>
                <DataTableCell align="right" numeric muted={false}>{((r.effort_minutes ?? 0) / 60).toFixed(2)}h</DataTableCell>
                <DataTableCell>
                  <StatusBadge variant={getStatusVariant(r.status)}>{r.status_display ?? r.status}</StatusBadge>
                </DataTableCell>
                {onReverseApproved && (
                  <DataTableCell align="right">
                    {canReverse && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleReverse(r.id) }}
                        disabled={reversingId === r.id}
                        title="Estornar aprovação"
                        className="inline-flex items-center justify-center p-1.5 rounded-md transition-colors disabled:opacity-40"
                        style={{ color: 'var(--danger-border)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Undo2 size={13} />
                      </button>
                    )}
                  </DataTableCell>
                )}
              </DataTableRow>
            )
          })}
        </DataTableBody>
      </DataTable>
    </div>
  )
}

function InlineTicketSummaryTable({ rows, loading }: { rows: any[]; loading: boolean }) {
  const fmtHHMM = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = Math.abs(mins % 60)
    return `${h}:${String(m).padStart(2, '0')}`
  }
  if (!loading && rows.length === 0) return null
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Apuração por Ticket</h3>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{rows.length} tickets</span>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left  px-4 py-2 text-xs uppercase tracking-wide">Ticket</th>
                <th className="text-left  px-4 py-2 text-xs uppercase tracking-wide">Título</th>
                <th className="text-left  px-4 py-2 text-xs uppercase tracking-wide">Solicitante</th>
                <th className="text-right px-4 py-2 text-xs uppercase tracking-wide whitespace-nowrap">Total no período</th>
                <th className="text-right px-4 py-2 text-xs uppercase tracking-wide whitespace-nowrap">Total histórico</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(tk => (
                <tr key={tk.ticket} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2">
                    <a href={`https://erpserv.movidesk.com/Ticket/Edit/${tk.ticket}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs hover:underline" style={{ color: 'var(--primary)' }}>#{tk.ticket}</a>
                  </td>
                  <td className="px-4 py-2" style={{ color: 'var(--text)' }}>{tk.title ?? '—'}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--text-muted)' }}>{tk.requester ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtHHMM(tk.period_minutes)}</td>
                  <td className="px-4 py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{fmtHHMM(tk.lifetime_minutes)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 600 }}>
                <td colSpan={3} className="px-4 py-2 text-right">Totais ({rows.length} {rows.length === 1 ? 'ticket' : 'tickets'})</td>
                <td className="px-4 py-2 text-right font-mono">{fmtHHMM(rows.reduce((s, r) => s + (r.period_minutes || 0), 0))}</td>
                <td className="px-4 py-2 text-right font-mono">{fmtHHMM(rows.reduce((s, r) => s + (r.lifetime_minutes || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

function ExportButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
        style={{ background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
      >
        <Download size={14} />
        Exportar Excel
      </button>
    </div>
  )
}
