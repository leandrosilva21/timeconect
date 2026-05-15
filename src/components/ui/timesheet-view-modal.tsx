'use client'

import { useState } from 'react'
import {
  X, Clock, Pencil, Calendar, User, Building2, FolderOpen,
  Ticket, Hash, Paperclip, FileText, CheckCircle, Globe, Webhook, DollarSign, TrendingUp, AlertCircle,
} from 'lucide-react'
import { Badge } from '@/components/ds'
import type { Timesheet } from '@/types'
import { sanitizeHtml } from '@/lib/sanitize'

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function AttachmentLink({ url }: { url: string }) {
  const [loading, setLoading] = useState(false)
  const open = async () => {
    setLoading(true)
    try {
      const res = await fetch(url, { credentials: 'same-origin' })
      if (!res.ok) { alert('Anexo não encontrado no servidor'); return }
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
    } catch { alert('Erro ao abrir anexo') }
    finally { setLoading(false) }
  }
  return (
    <button type="button" onClick={open} disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
      style={{ background: 'rgba(0,245,255,0.08)', color: 'var(--brand-primary)', border: '1px solid rgba(0,245,255,0.15)' }}>
      <Paperclip size={11} />
      {loading ? 'Abrindo...' : 'Visualizar Anexo'}
    </button>
  )
}

function InfoRow({ icon: Icon, label, value, children, last }: {
  icon: React.ElementType; label: string; value?: string | null
  children?: React.ReactNode; last?: boolean
}) {
  return (
    <div className={`flex items-start gap-4 px-5 py-4 ${!last ? 'border-b' : ''}`}
      style={!last ? { borderColor: 'var(--brand-border)' } : undefined}>
      <span className="mt-0.5 shrink-0 p-2 rounded-lg"
        style={{ background: 'rgba(0,245,255,0.06)', color: 'var(--brand-primary)' }}>
        <Icon size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-widest mb-1" style={{ color: 'var(--brand-subtle)' }}>{label}</p>
        {children ?? <p className="text-sm font-medium" style={{ color: 'var(--brand-text)' }}>{value ?? '—'}</p>}
      </div>
    </div>
  )
}

function OriginChip({ origin }: { origin?: string }) {
  if (origin === 'webhook') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6' }}>
      <Webhook size={11} /> Auto (Movidesk)
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: 'rgba(0,245,255,0.08)', color: 'var(--brand-primary)' }}>
      <Globe size={11} /> Web (manual)
    </span>
  )
}

export function TimesheetViewModal({
  ts, onClose, onEdit, currentUser,
}: {
  ts: Timesheet
  onClose: () => void
  onEdit?: () => void
  currentUser?: { type?: string | null } | null
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative w-full max-w-2xl mt-8 rounded-2xl shadow-2xl"
        style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: 'var(--brand-subtle)' }}>
          <X size={18} />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex items-start gap-4">
          <div className="p-3 rounded-2xl shrink-0"
            style={{ background: 'rgba(0,245,255,0.08)', color: 'var(--brand-primary)' }}>
            <Clock size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--brand-text)' }}>Detalhe do Apontamento</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--brand-subtle)' }}>
              #{ts.id} · {formatDate(ts.date)}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Status + origem + outros badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ts.status}>{ts.status_display ?? ts.status}</Badge>
            <OriginChip origin={ts.origin} />
            {ts.is_billable_only && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                <DollarSign size={12} /> Somente Faturável
              </span>
            )}
            {ts.rejection_reason && ['rejected', 'adjustment_requested'].includes(ts.status) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                <AlertCircle size={12} />
                {ts.status === 'adjustment_requested' ? 'Ajuste:' : 'Motivo:'} {ts.rejection_reason}
              </span>
            )}
          </div>

          {/* Período hero */}
          <div className="rounded-2xl px-5 py-5"
            style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.15)' }}>
            <p className="text-[11px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--brand-subtle)' }}>Período</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
              {ts.start_time} – {ts.end_time}
              <span className="ml-3 text-base font-medium" style={{ color: 'var(--brand-muted)' }}>({ts.effort_hours})</span>
            </p>
          </div>

          {/* Info card */}
          <div className="rounded-xl overflow-hidden"
            style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-border)' }}>
            <InfoRow icon={Calendar} label="Data" value={formatDate(ts.date)} />
            <InfoRow icon={User} label="Colaborador" value={ts.user?.name} />
            <InfoRow icon={Building2} label="Cliente" value={ts.customer?.name ?? ts.project?.customer?.name} />
            <InfoRow icon={FolderOpen} label="Projeto">
              <p className="text-xs font-medium" style={{ color: 'var(--brand-text)' }}>
                {ts.project?.name ?? '—'}
                {ts.project?.contract_type_display && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-md"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--brand-subtle)' }}>
                    {ts.project.contract_type_display}
                  </span>
                )}
              </p>
            </InfoRow>
            {ts.ticket && (
              <InfoRow icon={Ticket} label="Ticket">
                <p className="text-sm font-medium" style={{ color: 'var(--brand-text)' }}>
                  {ts.ticket.length >= 5
                    ? <a href={`https://erpserv.movidesk.com/Ticket/Edit/${ts.ticket}`} target="_blank" rel="noopener noreferrer"
                        className="hover:underline" style={{ color: 'var(--brand-primary)' }}>#{ts.ticket}</a>
                    : <span style={{ color: 'var(--brand-primary)' }}>#{ts.ticket}</span>
                  }
                  {ts.ticket_subject && (
                    <span className="ml-2" style={{ color: 'var(--brand-muted)' }}>— {ts.ticket_subject}</span>
                  )}
                </p>
              </InfoRow>
            )}
            {ts.ticket_solicitante?.name && (
              <InfoRow icon={Ticket} label="Solicitante">
                <p className="text-sm font-medium" style={{ color: 'var(--brand-text)' }}>
                  {ts.ticket_solicitante.name}
                  {ts.ticket_solicitante.organization && (
                    <span className="ml-2" style={{ color: 'var(--brand-muted)' }}>— {ts.ticket_solicitante.organization}</span>
                  )}
                </p>
              </InfoRow>
            )}
            {ts.movidesk_appointment_id && (
              <InfoRow icon={Hash} label="ID Movidesk" value={String(ts.movidesk_appointment_id)} />
            )}
            {(currentUser?.type === 'admin' || currentUser?.type === 'coordenador') && ts.client_extra_pct ? (
              <InfoRow icon={TrendingUp} label="Acréscimo Cliente" value={`+${ts.client_extra_pct}%`} />
            ) : null}
            {(currentUser?.type === 'admin' || currentUser?.type === 'coordenador') && ts.consultant_extra_pct ? (
              <InfoRow icon={TrendingUp} label="Acréscimo Consultor" value={`+${ts.consultant_extra_pct}%`} />
            ) : null}
            <InfoRow icon={Paperclip} label="Anexo" last>
              {(ts as any).attachment_url
                ? <AttachmentLink url={(ts as any).attachment_url} />
                : <span className="text-sm" style={{ color: 'var(--brand-subtle)' }}>Sem anexo</span>
              }
            </InfoRow>
          </div>

          {/* Observação */}
          {ts.observation && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-border)' }}>
              <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                <FileText size={14} style={{ color: 'var(--brand-primary)' }} />
                <span className="text-[11px] uppercase tracking-widest font-medium" style={{ color: 'var(--brand-subtle)' }}>Observação</span>
              </div>
              <div
                className="
                  px-5 py-4 text-sm leading-relaxed
                  [&_img]:max-w-full [&_img]:rounded-lg
                  [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse
                  [&_th]:border [&_th]:border-[var(--brand-border)] [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:bg-[var(--brand-bg)]
                  [&_td]:border [&_td]:border-[var(--brand-border)] [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top
                  [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1.5
                  [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5
                  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
                  [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1
                  [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                  [&_a]:underline [&_a]:text-[var(--brand-primary)]
                  [&_hr]:my-3 [&_hr]:border-[var(--brand-border)]
                "
                style={{ color: 'var(--brand-muted)' }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(ts.observation) }} />
            </div>
          )}

          {/* Revisão */}
          {ts.reviewedBy && (
            <div className="flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm"
              style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid var(--brand-border)', color: 'var(--brand-subtle)' }}>
              <CheckCircle size={14} style={{ color: 'var(--brand-primary)' }} />
              Revisado por <strong style={{ color: 'var(--brand-muted)' }}>{ts.reviewedBy.name}</strong>
              {ts.reviewed_at && ` em ${formatDate(ts.reviewed_at.slice(0, 10))}`}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {onEdit && (
              <button onClick={onEdit}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--brand-muted)', border: '1px solid var(--brand-border)' }}>
                <Pencil size={14} /> Editar
              </button>
            )}
            <button onClick={onClose}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: 'var(--brand-subtle)', border: '1px solid var(--brand-border)' }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
