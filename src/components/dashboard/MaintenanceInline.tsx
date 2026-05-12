'use client'

import React, { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import * as XLSX from 'xlsx'
import {
  Clock, Eye, Download, Calendar, User as UserIcon, Building2, Folder,
  Paperclip, FileText, X as CloseIcon,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

export type MaintenanceCategory = 'maintenance' | 'architecture'
export type MaintenanceKind = MaintenanceCategory | 'expenses'

// ─── Hook: orquestra fetch das listas + ticket summary ──────────────────────

export function useMaintenanceInline(opts: {
  enabled: boolean
  kind: MaintenanceKind
  customerId?: number | null
  projectId?: number | null
  dateFrom?: string
  dateTo?: string
}) {
  const { enabled, kind, customerId, projectId, dateFrom, dateTo } = opts
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [ticketSummary, setTicketSummary] = useState<any[]>([])
  const [ticketLoading, setTicketLoading] = useState(false)

  useEffect(() => {
    if (!enabled) { setRows([]); setTicketSummary([]); return }
    setLoading(true)
    const qs = new URLSearchParams()
    if (customerId) qs.set('customer_id', String(customerId))
    if (projectId)  qs.set('project_id', String(projectId))
    if (dateFrom)   qs.set('date_from', dateFrom)
    if (dateTo)     qs.set('date_to', dateTo)
    const path = kind === 'expenses'
      ? `/dashboards/bank-hours-fixed/expenses?${qs}`
      : `/dashboards/bank-hours-fixed/category-timesheets?${qs}&category=${kind}`
    api.get<{ data: any[] }>(path)
      .then(r => setRows(r.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))

    // Apuração por ticket — só pra Sustentação
    if (kind === 'maintenance') {
      setTicketLoading(true)
      api.get<{ tickets: any[] }>(`/dashboards/bank-hours-fixed/category-ticket-summary?${qs}&category=maintenance`)
        .then(r => setTicketSummary(r.tickets ?? []))
        .catch(() => setTicketSummary([]))
        .finally(() => setTicketLoading(false))
    } else {
      setTicketSummary([])
    }
  }, [enabled, kind, customerId, projectId, dateFrom, dateTo])

  return { rows, loading, ticketSummary, ticketLoading }
}

// ─── Export Excel ───────────────────────────────────────────────────────────

export function exportMaintenanceToXLSX(kind: MaintenanceKind, rows: any[]) {
  if (rows.length === 0) return
  const sheetName = kind === 'expenses' ? 'Despesas' : (kind === 'architecture' ? 'Arquitetura' : 'Sustentação')
  const data = kind === 'expenses'
    ? rows.map(r => ({
        Data: r.date ? r.date.split('-').reverse().join('/') : '',
        Colaborador: r.user?.name ?? '',
        Valor: Number(r.amount) || 0,
      }))
    : kind === 'maintenance'
      ? rows.map(r => ({
          Data: r.date ? r.date.split('-').reverse().join('/') : '',
          Solicitante: r.requester ?? '',
          Consultor: r.user?.name ?? '',
          Ticket: r.ticket ?? '',
          'Titulo do ticket': r.ticket_subject ?? '',
          Descrição: r.description ?? '',
          Início: r.start_time ?? '',
          Fim: r.end_time ?? '',
          'Esforço (h)': Number(((r.effort_minutes ?? 0) / 60).toFixed(2)),
          'Data do Serviço': r.date ? r.date.split('-').reverse().join('/') : '',
        }))
      : rows.map(r => ({
          Data: r.date ? r.date.split('-').reverse().join('/') : '',
          Consultor: r.user?.name ?? '',
          Descrição: r.description ?? '',
          'Esforço (h)': Number(((r.effort_minutes ?? 0) / 60).toFixed(2)),
        }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${sheetName.toLowerCase()}_${stamp}.xlsx`)
}

// ─── Inline Components ─────────────────────────────────────────────────────

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
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

export function InlineTimesheetsTable({ rows, loading, variant = 'maintenance', onRowClick }: {
  rows: any[]
  loading: boolean
  variant?: 'maintenance' | 'architecture'
  onRowClick?: (r: any) => void
}) {
  const isArch = variant === 'architecture'
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Apontamentos do período</h3>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{rows.length} registros</span>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Sem apontamentos no período selecionado.</div>
        ) : isArch ? (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left  px-4 py-2 text-xs uppercase tracking-wide">Data</th>
                <th className="text-left  px-4 py-2 text-xs uppercase tracking-wide">Consultor</th>
                <th className="text-left  px-4 py-2 text-xs uppercase tracking-wide">Descrição</th>
                <th className="text-right px-4 py-2 text-xs uppercase tracking-wide">Horas</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={onRowClick ? 'cursor-pointer' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2 whitespace-nowrap">{r.date ? r.date.split('-').reverse().join('/') : '—'}</td>
                  <td className="px-4 py-2">{r.user?.name ?? '—'}</td>
                  <td className="px-4 py-2 max-w-2xl truncate" style={{ color: 'var(--text-muted)' }} title={r.description ?? '—'}>{r.description ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-mono whitespace-nowrap">{((r.effort_minutes ?? 0) / 60).toFixed(2)}h</td>
                  {onRowClick && <td className="px-2 py-2"><Eye size={14} style={{ color: 'var(--text-muted)' }} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left  px-3 py-2 text-xs uppercase tracking-wide">Data</th>
                <th className="text-left  px-3 py-2 text-xs uppercase tracking-wide">Solicitante</th>
                <th className="text-left  px-3 py-2 text-xs uppercase tracking-wide">Consultor</th>
                <th className="text-left  px-3 py-2 text-xs uppercase tracking-wide">Ticket</th>
                <th className="text-left  px-3 py-2 text-xs uppercase tracking-wide">Título do ticket</th>
                <th className="text-left  px-3 py-2 text-xs uppercase tracking-wide">Descrição</th>
                <th className="text-left  px-3 py-2 text-xs uppercase tracking-wide">Início</th>
                <th className="text-left  px-3 py-2 text-xs uppercase tracking-wide">Fim</th>
                <th className="text-right px-3 py-2 text-xs uppercase tracking-wide whitespace-nowrap">Esforço (h)</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const desc = r.description ?? '—'
                return (
                  <tr key={r.id} className={onRowClick ? 'cursor-pointer' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-3 py-2 whitespace-nowrap">{r.date ? r.date.split('-').reverse().join('/') : '—'}</td>
                    <td className="px-3 py-2">{r.requester ?? '—'}</td>
                    <td className="px-3 py-2">{r.user?.name ?? '—'}</td>
                    <td className="px-3 py-2">
                      {r.ticket
                        ? <a href={`https://erpserv.movidesk.com/Ticket/Edit/${r.ticket}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs hover:underline" style={{ color: 'var(--primary)' }} onClick={e => e.stopPropagation()}>#{r.ticket}</a>
                        : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate" style={{ color: 'var(--text-muted)' }} title={r.ticket_subject ?? '—'}>{r.ticket_subject ?? '—'}</td>
                    <td className="px-3 py-2 max-w-sm truncate" style={{ color: 'var(--text-muted)' }} title={desc}>{desc}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.start_time ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.end_time ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{((r.effort_minutes ?? 0) / 60).toFixed(2)}</td>
                    {onRowClick && <td className="px-2 py-2"><Eye size={14} style={{ color: 'var(--text-muted)' }} /></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export function InlineTicketSummaryTable({ rows, loading }: { rows: any[]; loading: boolean }) {
  const fmtH = (mins: number) => {
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
                  <td className="px-4 py-2 text-right font-mono">{fmtH(tk.period_minutes)}</td>
                  <td className="px-4 py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{fmtH(tk.lifetime_minutes)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 600 }}>
                <td colSpan={3} className="px-4 py-2 text-right">Totais ({rows.length} {rows.length === 1 ? 'ticket' : 'tickets'})</td>
                <td className="px-4 py-2 text-right font-mono">{fmtH(rows.reduce((s, r) => s + (r.period_minutes || 0), 0))}</td>
                <td className="px-4 py-2 text-right font-mono">{fmtH(rows.reduce((s, r) => s + (r.lifetime_minutes || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

export function InlineExpensesTable({ rows, loading }: { rows: any[]; loading: boolean }) {
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Despesas do período</h3>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{rows.length} registros</span>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Sem despesas no período selecionado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left  px-4 py-2 text-xs uppercase tracking-wide">Data</th>
                <th className="text-left  px-4 py-2 text-xs uppercase tracking-wide">Colaborador</th>
                <th className="text-right px-4 py-2 text-xs uppercase tracking-wide">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2 whitespace-nowrap">{r.date ? r.date.split('-').reverse().join('/') : '—'}</td>
                  <td className="px-4 py-2">{r.user?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-mono whitespace-nowrap">{fmtBRL(Number(r.amount) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{value}</div>
      </div>
    </div>
  )
}

export function TimesheetDetailModal({ ts, onClose }: { ts: any; onClose: () => void }) {
  const fmtDateBR = (iso: string | null) => iso ? iso.split('-').reverse().join('/') : '—'
  const period = (ts.start_time && ts.end_time) ? `${ts.start_time} – ${ts.end_time}` : null
  const hours = ((ts.effort_minutes ?? 0) / 60)
  const hoursDisplay = `${Math.floor(hours)}:${String(Math.round((hours - Math.floor(hours)) * 60)).padStart(2, '0')}`
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl mt-8 rounded-2xl overflow-hidden" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
        <div className="px-6 py-5 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,245,255,0.10)' }}>
              <Clock size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Detalhe do Apontamento</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>#{ts.id} · {fmtDateBR(ts.date)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:opacity-70" style={{ color: 'var(--text-muted)' }}><CloseIcon size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {period && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.2)' }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Período</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                {period} <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>({hoursDisplay})</span>
              </p>
            </div>
          )}

          <div className="rounded-xl divide-y" style={{ background: 'var(--brand-surface)', border: '1px solid var(--border)' }}>
            <DetailRow icon={<Calendar size={14} />} label="Data" value={fmtDateBR(ts.date)} />
            <DetailRow icon={<UserIcon size={14} />} label="Colaborador" value={ts.user?.name ?? '—'} />
            <DetailRow icon={<Building2 size={14} />} label="Cliente" value={ts.customer ?? '—'} />
            <DetailRow icon={<Folder size={14} />} label="Projeto" value={
              <div className="flex items-center gap-2 flex-wrap">
                <span>{ts.project?.name ?? '—'}</span>
                {ts.project?.contract_type && (
                  <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>{ts.project.contract_type}</span>
                )}
              </div>
            } />
            <DetailRow icon={<Paperclip size={14} />} label="Anexo" value={ts.attachment_path ? <a href={ts.attachment_path} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Ver anexo</a> : 'Sem anexo'} />
            {ts.ticket && (
              <DetailRow icon={<FileText size={14} />} label="Ticket" value={
                <a href={`https://erpserv.movidesk.com/Ticket/Edit/${ts.ticket}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs" style={{ color: 'var(--primary)' }}>#{ts.ticket}{ts.ticket_subject ? ` · ${ts.ticket_subject}` : ''}</a>
              } />
            )}
          </div>

          {ts.description && (
            <div className="rounded-xl p-4" style={{ background: 'var(--brand-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} style={{ color: 'var(--primary)' }} />
                <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Observação</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text)' }}>{ts.description}</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
