'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useAuth } from '@/hooks/use-auth'
import { usePersistedFilters } from '@/hooks/use-persisted-filters'
import { api } from '@/lib/api'
import { formatBRL } from '@/lib/format'
import { RefreshCw, Printer, FileText, Users, Search, X, Mail, Paperclip, Send, MessagesSquare, AlertTriangle, CornerDownLeft } from 'lucide-react'
import { toast } from 'sonner'
import { previewText } from '@/lib/sanitize'
import {
  PageHeader, Table, Thead, Th, Tbody, Tr, Td,
  Button, SkeletonTable, EmptyState,
} from '@/components/ds'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsultorBase {
  user_id: number
  nome: string
  email: string
  type: string
  consultant_type: string
  horas_trabalhadas: number
  valor_hora: number
  rate_type: string
  effective_rate: number
  horas_a_pagar: number
  total: number
}

interface ConsultorHorista extends ConsultorBase {
  guaranteed_hours: number
  guaranteed_prorated: number
  proporcional: boolean
  ratio: number
  dias_uteis_periodo: number
  dias_uteis_cheio: number
  data_inicio: string | null
  total_extras: number
}

interface ConsultorBancoHoras extends ConsultorBase {
  daily_hours: number
  working_days: number
  expected_hours: number
  month_balance: number
  previous_balance: number
  accumulated_balance: number
  paid_hours: number
  final_balance: number
  fixed_salary: number
  valor_hora_extra: number
  horas_extras: number
  total_extra: number
}

interface ConsultorFixo extends ConsultorBase {
  salario_mensal: number
}

interface Totais {
  total_horistas: number
  total_banco_horas: number
  total_fixos: number
  total_geral: number
}

interface IndexData {
  horistas: ConsultorHorista[]
  banco_horas: ConsultorBancoHoras[]
  fixos: ConsultorFixo[]
  totais: Totais
}

interface ApontamentoRow {
  id: number
  data: string
  start_time?: string | null
  end_time?: string | null
  projeto: string
  projeto_codigo: string
  cliente: string
  tipo_contrato_code: string
  tipo_contrato_nome: string
  horas: number       // efetivas (infladas para banco de horas, base para horista)
  horas_base?: number // horas originais sem o acréscimo
  status: string
  ticket?: string
  titulo?: string
  observacao?: string
  consultant_extra_pct?: number | null
  valor_extra?: number | null // apenas horista/fixo
}

interface ThreadMessage {
  id: number
  subject: string
  body: string | null
  is_continuation: boolean
  has_attachments: boolean
  sender_name: string | null
  to_email: string | null
  cc_email: string | null
  status: string
  sent_at: string | null
  // Fase 2 — respostas inbound lidas via Microsoft Graph (opcionais p/ retrocompat).
  direction?: 'outbound' | 'inbound'
  is_inbound?: boolean
  from_email?: string | null
  received_at?: string | null
  at?: string | null // timestamp unificado (sent_at p/ outbound, received_at p/ inbound)
}

type Tab = 'horistas' | 'banco_horas' | 'fixo' | 'resumo'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtYearMonth(ym: string): string {
  if (!ym) return ''
  const [year, month] = ym.split('-')
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${months[parseInt(month) - 1]} de ${year}`
}

function fmtDate(d: string): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtH(h: number): string {
  const sign     = h < 0 ? '-' : ''
  const totalMins = Math.abs(Math.round(h * 60))
  const hrs  = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  return `${sign}${hrs}h${String(mins).padStart(2, '0')}`
}

function balanceColor(val: number): string {
  if (val > 0) return 'text-emerald-400'
  if (val < 0) return 'text-red-400'
  return 'text-zinc-400'
}

// status pode chegar como 'sent'/'enviado', 'failed'/'falhou' ou 'pending'/'pendente'.
function isFailed(status: string): boolean {
  return status === 'failed' || status === 'falhou'
}

// ─── Print ────────────────────────────────────────────────────────────────────

const printStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; }
  .page { padding: 28px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #7c3aed; padding-bottom: 14px; }
  .logo img { height: 48px; width: auto; display: block; }
  .meta { text-align: right; font-size: 11px; color: #555; line-height: 1.6; }
  .meta strong { font-size: 15px; color: #1a1a1a; display: block; margin-bottom: 4px; }
  .summary-box { display: flex; gap: 24px; background: #f9f7ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; }
  .summary-item { flex: 1; }
  .summary-label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
  .summary-value { font-size: 14px; font-weight: 700; color: #1a1a1a; }
  .section { margin-bottom: 20px; break-inside: avoid; }
  .section-header { display: flex; justify-content: space-between; align-items: center; background: #ede9fe; border-left: 3px solid #7c3aed; padding: 6px 10px; margin-bottom: 6px; border-radius: 0 4px 4px 0; }
  .section-title { font-size: 11px; font-weight: 700; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.4px; }
  .section-total { font-size: 12px; font-weight: 700; color: #5b21b6; }
  .client-header { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; margin: 8px 0 4px; border-bottom: 1px solid #ddd6fe; }
  .client-name { font-size: 11px; font-weight: 700; color: #1a1a1a; }
  .client-total { font-size: 11px; color: #7c3aed; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 5px 8px; text-align: left; color: #555; border-bottom: 1px solid #ddd; }
  td { font-size: 11px; padding: 4px 8px; border-bottom: 1px solid #f0f0f0; }
  tbody tr.main-row td { padding-bottom: 2px; border-bottom: none; }
  tbody tr.desc-row td { padding-top: 2px; padding-bottom: 7px; border-bottom: 2px solid #5b21b6; font-size: 11px; color: #374151; white-space: pre-wrap; }
  tbody tr.desc-row td .label { font-weight: 600; color: #6b7280; margin-right: 4px; }
  .right { text-align: right; }
  .center { text-align: center; }
  .total-box { background: #7c3aed; color: #fff; padding: 12px 18px; margin-top: 24px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
  .total-label { font-size: 13px; font-weight: 700; }
  .total-value { font-size: 20px; font-weight: 900; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`

function buildReport(
  consultor: ConsultorBase | ConsultorHorista | ConsultorBancoHoras | ConsultorFixo,
  apontamentos: ApontamentoRow[],
  yearMonth: string
): string {
  const grouped = new Map<string, ApontamentoRow[]>()
  for (const apt of apontamentos) {
    const key = apt.tipo_contrato_nome || 'Sem tipo'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(apt)
  }

  let summaryExtra = ''
  if ('fixed_salary' in consultor) {
    const c = consultor as ConsultorBancoHoras
    summaryExtra = `
      <div class="summary-item"><div class="summary-label">Base Mensal</div><div class="summary-value">${formatBRL(c.fixed_salary)}</div></div>
      <div class="summary-item"><div class="summary-label">Saldo Acumulado</div><div class="summary-value">${fmtH(c.accumulated_balance)}</div></div>
      <div class="summary-item"><div class="summary-label">H Extras</div><div class="summary-value">${c.horas_extras > 0 ? fmtH(c.horas_extras) : '—'}</div></div>
    `
  } else if ('salario_mensal' in consultor) {
    const c = consultor as ConsultorFixo
    summaryExtra = `
      <div class="summary-item"><div class="summary-label">Salário Mensal</div><div class="summary-value">${formatBRL(c.salario_mensal)}</div></div>
    `
  } else {
    const ch = consultor as ConsultorHorista
    const hasGuaranteed = ch.guaranteed_prorated > 0 && ch.horas_a_pagar > ch.horas_trabalhadas
    summaryExtra = `
      ${hasGuaranteed ? `
        <div class="summary-item"><div class="summary-label">H Garantidas (mín)</div><div class="summary-value" style="color:#d97706">${fmtH(ch.guaranteed_prorated)}</div></div>
        <div class="summary-item"><div class="summary-label">H a Pagar</div><div class="summary-value">${fmtH(ch.horas_a_pagar)}</div></div>
      ` : ''}
      <div class="summary-item"><div class="summary-label">Taxa/h</div><div class="summary-value">${formatBRL(consultor.effective_rate)}</div></div>
    `
  }

  let sectionsHtml = ''
  if (grouped.size === 0) {
    sectionsHtml = '<p style="color:#999;text-align:center;padding:16px;">Nenhum apontamento no período</p>'
  } else {
    for (const [tipo, rows] of grouped.entries()) {
      const totalHoras = rows.reduce((s, r) => s + r.horas, 0)

      // Sub-group by client within each contract type
      const byCliente = new Map<string, ApontamentoRow[]>()
      for (const r of rows) {
        const c = r.cliente || 'Sem cliente'
        if (!byCliente.has(c)) byCliente.set(c, [])
        byCliente.get(c)!.push(r)
      }

      let clienteBlocksHtml = ''
      for (const [cliente, clienteRows] of byCliente.entries()) {
        const clienteHoras = clienteRows.reduce((s, r) => s + r.horas, 0)
        const rowsHtml = clienteRows.map(r => `
          <tr class="main-row">
            <td>${fmtDate(r.data)}</td>
            <td>${r.cliente || '—'}</td>
            <td><span style="color:#888;margin-right:4px">${r.projeto_codigo}</span>${r.projeto}</td>
            <td>${r.ticket ?? '—'}</td>
            <td>${r.titulo ?? '—'}</td>
            <td class="center">${r.start_time ? (r.start_time.includes('T') ? r.start_time.slice(11, 16) : r.start_time.slice(0, 5)) : '—'}</td>
            <td class="center">${r.end_time   ? (r.end_time.includes('T')   ? r.end_time.slice(11, 16)   : r.end_time.slice(0, 5))   : '—'}</td>
            <td class="right">${fmtH(r.horas)}${r.consultant_extra_pct ? (r.valor_extra != null ? `<span style="color:#16a34a;font-size:10px;margin-left:4px">+${r.consultant_extra_pct}% (${formatBRL(r.valor_extra)})</span>` : `<span style="color:#16a34a;font-size:10px;margin-left:4px">+${r.consultant_extra_pct}% base ${fmtH(r.horas_base ?? r.horas)}</span>`) : ''}</td>
          </tr>
          <tr class="desc-row">
            <td colspan="8"><span class="label">Descrição:</span>${r.observacao ?? '—'}</td>
          </tr>
        `).join('')
        clienteBlocksHtml += `
          <div class="client-header">
            <span class="client-name">${cliente}</span>
            <span class="client-total">${fmtH(clienteHoras)}</span>
          </div>
          <table>
            <thead><tr><th>Data</th><th>Cliente</th><th>Projeto</th><th>Ticket</th><th>Título</th><th class="center">Início</th><th class="center">Fim</th><th class="right">Horas / Extra</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `
      }

      sectionsHtml += `
        <div class="section">
          <div class="section-header">
            <span class="section-title">${tipo}</span>
            <span class="section-total">${fmtH(totalHoras)}</span>
          </div>
          ${clienteBlocksHtml}
        </div>
      `
    }
  }

  const totalHoras = apontamentos.reduce((s, r) => s + r.horas, 0)

  return `
    <div class="page">
      <div class="header">
        <div class="logo"><img src="${window.location.origin}/logo.png" alt="ERPServ Consultoria" /></div>
        <div class="meta">
          <strong>${consultor.nome}</strong>
          Fechamento de Consultores &nbsp;·&nbsp; ${fmtYearMonth(yearMonth)}
        </div>
      </div>
      <div class="summary-box">
        <div class="summary-item"><div class="summary-label">Total Horas</div><div class="summary-value">${fmtH(totalHoras)}</div></div>
        ${summaryExtra}
        <div class="summary-item"><div class="summary-label">Total a Pagar</div><div class="summary-value" style="color:#7c3aed">${formatBRL(consultor.total)}</div></div>
      </div>
      ${sectionsHtml}
      <div class="total-box">
        <span class="total-label">TOTAL A PAGAR — ${consultor.nome.toUpperCase()}</span>
        <span class="total-value">${formatBRL(consultor.total)}</span>
      </div>
    </div>
  `
}

function buildFullHtml(html: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório</title><style>${printStyles}</style></head><body>${html}</body></html>`
}

// ─── RelatorioBtn ─────────────────────────────────────────────────────────────

function RelatorioBtn({ userId, printingUser, onClick }: {
  userId: number
  printingUser: number | null
  onClick: () => void
}) {
  const loading = printingUser === userId
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title="Gerar relatório individual"
      className="inline-flex items-center gap-1 text-xs disabled:opacity-50 transition-colors ds-link"
    >
      {loading ? <RefreshCw size={13} className="animate-spin" /> : <Printer size={13} />}
      Relatório
    </button>
  )
}

// ─── ConversaPanel (thread + continuação) ──────────────────────────────────────

function ConversaPanel({
  thread, loading, reportHtml, replyBody, onReplyBody, replyAttach, onReplyAttach, sending, onSend,
  onSync, syncing, syncFeedback,
}: {
  thread: ThreadMessage[]
  loading: boolean
  reportHtml: string | null
  replyBody: string
  onReplyBody: (v: string) => void
  replyAttach: boolean
  onReplyAttach: (v: boolean) => void
  sending: boolean
  onSend: () => void
  onSync: () => void
  syncing: boolean
  syncFeedback: { kind: 'imported' | 'none' | 'disabled' | 'error'; text: string } | null
}) {
  // Timestamp unificado: `at` (já cronológico no backend) com fallback p/ sent_at/received_at.
  const msgTs = (m: ThreadMessage): string | null => m.at ?? m.sent_at ?? m.received_at ?? null
  // Ordena por data (fallback id) pra identificar a mensagem mais recente.
  const ordered = [...thread].sort((a, b) => {
    const ta = msgTs(a) ? new Date(msgTs(a) as string).getTime() : 0
    const tb = msgTs(b) ? new Date(msgTs(b) as string).getTime() : 0
    if (ta !== tb) return ta - tb
    return a.id - b.id
  })
  const latest = ordered.length > 0 ? ordered[ordered.length - 1] : null
  const lastSendFailed = latest ? isFailed(latest.status) : false
  // Esconde mensagens com falha da lista — o aviso da última falha vai no topo do container.
  const visible = ordered.filter(m => !isFailed(m.status))
  const hasThread = thread.length > 0   // controla o box de resposta (envio já existiu)
  const hasVisible = visible.length > 0

  // Reading pane estilo Outlook: clicar numa linha abre uma visão de leitura que
  // desliza da direita cobrindo quase a tela inteira (sobre o modal do relatório).
  const [openId, setOpenId] = useState<number | null>(null)
  const openMsg = openId != null ? visible.find(m => m.id === openId) ?? null : null

  // Caption do sync some sozinha após alguns segundos (limpa visualmente; o estado
  // real é resetado pelo container na próxima ação). 'error'/'disabled' ficam mais tempo.
  const [feedbackHidden, setFeedbackHidden] = useState(false)
  useEffect(() => {
    if (!syncFeedback) return
    setFeedbackHidden(false)
    const ms = syncFeedback.kind === 'imported' || syncFeedback.kind === 'none' ? 4000 : 6000
    const t = setTimeout(() => setFeedbackHidden(true), ms)
    return () => clearTimeout(t)
  }, [syncFeedback])

  // Esc fecha o reading pane.
  useEffect(() => {
    if (openId == null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpenId(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [openId])

  // Se a thread recarregar e a mensagem aberta sumir, fecha o reading pane.
  useEffect(() => {
    if (openId != null && !visible.some(m => m.id === openId)) setOpenId(null)
  }, [openId, visible])

  return (
    <aside
      className="w-full max-w-sm shrink-0 flex flex-col min-h-0"
      style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <MessagesSquare size={15} style={{ color: 'var(--primary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Conversa do fechamento</span>
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            title="Buscar novas respostas do consultor"
            className="ml-auto inline-flex items-center gap-1 text-xs disabled:opacity-50 transition-colors ds-link"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : undefined} />
            Atualizar
          </button>
        </div>
        {syncFeedback && !feedbackHidden && (
          <p
            className="mt-1.5 text-[11px]"
            style={{ color: syncFeedback.kind === 'imported' ? 'var(--primary)' : 'var(--text-muted)' }}
          >
            {syncFeedback.text}
          </p>
        )}
      </div>

      {/* Área de leitura */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {loading ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw size={13} className="animate-spin" /> Carregando conversa…
          </div>
        ) : !hasThread ? (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Nenhuma mensagem ainda. Envie o fechamento original pelo botão acima para iniciar a conversa.
          </p>
        ) : (
          <>
            {/* Aviso quando o último envio falhou (sem poluir a thread com cada falha) */}
            {lastSendFailed && (
              <div
                className="flex items-center gap-1.5 mb-3 rounded-md px-2.5 py-1.5 text-[11px] font-medium"
                style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
              >
                <AlertTriangle size={13} className="shrink-0" />
                Último envio falhou
              </div>
            )}

            {!hasVisible ? (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Nenhum envio bem-sucedido ainda.
              </p>
            ) : (
              /* Container único — thread estilo Outlook, uma linha por mensagem */
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
                {visible.map((m, idx) => {
                  const bodyText = previewText(m.body)
                  const inbound = m.is_inbound === true || m.direction === 'inbound'
                  return (
                    <div
                      key={m.id}
                      style={idx > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
                    >
                      {/* Linha clicável — abre o reading pane.
                          Inbound (resposta recebida) ganha borda lateral primary + leve indent. */}
                      <button
                        type="button"
                        onClick={() => setOpenId(m.id)}
                        className="w-full text-left px-3 py-2.5 transition-colors ds-row-hover"
                        style={inbound ? { borderLeft: '2px solid var(--primary)', paddingLeft: '1.25rem' } : undefined}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 min-w-0">
                            {inbound && (
                              <CornerDownLeft size={12} className="shrink-0" style={{ color: 'var(--primary)' }} aria-label="Resposta recebida" />
                            )}
                            <span className="text-xs font-semibold truncate" style={{ color: inbound ? 'var(--primary)' : 'var(--text)' }}>
                              {inbound ? `Resposta de ${m.from_email ?? 'consultor'}` : (m.sender_name ?? 'Sistema')}
                            </span>
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {m.has_attachments && (
                              <Paperclip size={12} style={{ color: 'var(--text-muted)' }} aria-label="Com anexos" />
                            )}
                            <span className="text-[11px]" style={{ color: 'var(--text-light)' }}>
                              {fmtDateTime(m.at ?? m.sent_at ?? m.received_at ?? null)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>
                            {m.subject}
                          </span>
                          {m.is_continuation && !inbound && (
                            <span className="text-[10px] shrink-0" style={{ color: 'var(--primary)' }}>· resposta</span>
                          )}
                        </div>
                        {/* Snippet compacto */}
                        {bodyText && (
                          <p className="mt-1 text-[11px] leading-relaxed line-clamp-1" style={{ color: 'var(--text-light)' }}>
                            {bodyText}
                          </p>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Reading pane (overlay) — desliza da direita cobrindo quase a tela.
          z acima do modal do relatório (z-50). */}
      {openMsg && (
        <div className="fixed inset-0 z-[60] flex" style={{ paddingTop: 'var(--banner-h, 0px)' }}>
          {/* Backdrop escurece o resto; clique fecha */}
          <button
            type="button"
            aria-label="Fechar leitura"
            onClick={() => setOpenId(null)}
            className="flex-1 cursor-default"
            style={{ background: 'rgba(0,0,0,0.55)', border: 'none' }}
          />
          {/* Painel ancorado à direita (~88vw) */}
          <div
            className="h-full flex flex-col min-h-0"
            style={{
              width: '88vw',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              boxShadow: 'var(--shadow-overlay)',
            }}
          >
            {/* Header do e-mail */}
            {(() => {
              const openInbound = openMsg.is_inbound === true || openMsg.direction === 'inbound'
              return (
            <>
            <div className="flex items-start justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {openMsg.subject}
                  </h2>
                  {openInbound ? (
                    <span className="inline-flex items-center gap-1 text-[11px] shrink-0" style={{ color: 'var(--primary)' }}>
                      <CornerDownLeft size={13} aria-hidden /> Recebido
                    </span>
                  ) : openMsg.is_continuation && (
                    <span className="text-[11px] shrink-0" style={{ color: 'var(--primary)' }}>· resposta</span>
                  )}
                  {openMsg.has_attachments && (
                    <Paperclip size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} aria-label="Com anexos" />
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-medium" style={{ color: 'var(--text)' }}>
                    {openInbound ? (openMsg.from_email ?? 'Consultor') : (openMsg.sender_name ?? 'Sistema')}
                  </span>
                  <span style={{ color: 'var(--text-light)' }}>{fmtDateTime(openMsg.at ?? openMsg.sent_at ?? openMsg.received_at ?? null)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]" style={{ color: 'var(--text-light)' }}>
                  {openMsg.to_email && <span><span style={{ color: 'var(--text-muted)' }}>Para:</span> {openMsg.to_email}</span>}
                  {openMsg.cc_email && <span><span style={{ color: 'var(--text-muted)' }}>Cc:</span> {openMsg.cc_email}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                title="Fechar (Esc)"
                className="shrink-0 inline-flex items-center justify-center rounded-lg p-1.5 transition-colors ds-row-hover"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Corpo do e-mail.
                Inbound (resposta recebida) e continuações outbound renderizam o texto;
                só o original outbound renderiza o iframe do relatório. */}
            <div className="flex-1 min-h-0 overflow-hidden flex">
              {openInbound || openMsg.is_continuation ? (
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                    {previewText(openMsg.body) || (
                      <span style={{ color: 'var(--text-muted)' }}>(sem conteúdo)</span>
                    )}
                  </p>
                </div>
              ) : reportHtml ? (
                // Original = o próprio relatório do fechamento (HTML com fundo branco).
                <iframe
                  srcDoc={reportHtml}
                  title="E-mail original do fechamento"
                  className="flex-1 h-full"
                  style={{ background: '#fff', border: 'none' }}
                />
              ) : (
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    E-mail original do fechamento (anexos PDF/XLSX).
                  </p>
                </div>
              )}
            </div>
            </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Continuar / Responder */}
      <div className="px-4 py-3 shrink-0 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Continuar / Responder</p>
        <textarea
          value={replyBody}
          onChange={e => onReplyBody(e.target.value)}
          placeholder={hasThread ? 'Escreva sua mensagem…' : 'Envie o fechamento original antes de responder.'}
          disabled={!hasThread || sending}
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none ds-input resize-none disabled:opacity-50"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={replyAttach}
            onChange={e => onReplyAttach(e.target.checked)}
            disabled={!hasThread || sending}
            className="accent-current"
            style={{ accentColor: 'var(--primary)' }}
          />
          Anexar fechamento atualizado
        </label>
        <button
          onClick={onSend}
          disabled={!hasThread || sending || !replyBody.trim()}
          className="w-full inline-flex items-center justify-center gap-1.5 ds-btn-primary disabled:opacity-50"
        >
          {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
          {sending ? 'Enviando…' : 'Enviar resposta'}
        </button>
      </div>
    </aside>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FechamentoConsultorPage() {
  const { user } = useAuth()
  const now = new Date()
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const { filters: flt, set: setFilter } = usePersistedFilters(
    'fechamento_consultor',
    user?.id,
    { yearMonth: defaultYearMonth, tab: 'horistas' as Tab },
  )
  const { yearMonth, tab } = flt
  const setYearMonth = (v: string) => setFilter('yearMonth', v)
  const setTab       = (v: Tab)    => setFilter('tab', v)
  const [data, setData] = useState<IndexData | null>(null)
  const [loading, setLoading] = useState(false)
  const [printingUser, setPrintingUser] = useState<number | null>(null)
  const [reportHtml, setReportHtml] = useState<string | null>(null)
  // Consultor alvo do relatório aberto (só pra relatório INDIVIDUAL — habilita o "Enviar e-mail").
  const [reportTarget, setReportTarget] = useState<{ userId: number; name: string } | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  // Thread (conversa do fechamento) — só no relatório individual.
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replyAttach, setReplyAttach] = useState(true)
  const [sendingReply, setSendingReply] = useState(false)
  // Sync inbox (puxar respostas inbound sob demanda via Microsoft Graph).
  const [syncingInbox, setSyncingInbox] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<
    { kind: 'imported' | 'none' | 'disabled' | 'error'; text: string } | null
  >(null)
  const reportIframeRef = useRef<HTMLIFrameElement>(null)
  const canSendEmail = user?.type === 'admin' || user?.type === 'administrativo'
  const [apenasComMovimento, setApenasComMovimento] = useState(true)
  const [filterNome, setFilterNome] = useState('')

  const load = useCallback(async () => {
    if (!yearMonth) return
    setLoading(true)
    setData(null)
    try {
      const res = await api.get<{ data: IndexData }>(`/fechamento-consultor/${yearMonth}`)
      setData(res.data)
    } finally {
      setLoading(false)
    }
  }, [yearMonth])

  useEffect(() => { load() }, [load])

  const loadThread = useCallback(async (userId: number) => {
    if (!yearMonth) return
    setThreadLoading(true)
    try {
      const res = await api.get<{ data: ThreadMessage[] }>(
        `/fechamento-consultor/${userId}/${yearMonth}/thread`,
      )
      setThread(res.data ?? [])
    } catch {
      setThread([])
    } finally {
      setThreadLoading(false)
    }
  }, [yearMonth])

  async function sendReportEmail() {
    if (!reportTarget) return
    setSendingEmail(true)
    try {
      // O detalhamento (PDF + XLSX) é gerado no backend; não enviamos mais o HTML.
      const res = await api.post<{ success: boolean; message: string }>(
        `/fechamento-consultor/${reportTarget.userId}/${yearMonth}/enviar-email`,
        {},
      )
      toast.success(res?.message ?? 'Fechamento enviado por e-mail.')
      await loadThread(reportTarget.userId)
    } catch (err: unknown) {
      toast.error(`Erro ao enviar o fechamento: ${err instanceof Error ? err.message : 'falha na API'}`)
    } finally {
      setSendingEmail(false)
    }
  }

  async function sendContinuation() {
    if (!reportTarget) return
    if (!replyBody.trim()) {
      toast.error('Escreva uma mensagem antes de enviar.')
      return
    }
    setSendingReply(true)
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        `/fechamento-consultor/${reportTarget.userId}/${yearMonth}/continuar`,
        { body: replyBody.trim(), attach_fechamento: replyAttach },
      )
      toast.success(res?.message ?? 'Resposta enviada.')
      setReplyBody('')
      await loadThread(reportTarget.userId)
    } catch (err: unknown) {
      toast.error(`Erro ao enviar a resposta: ${err instanceof Error ? err.message : 'falha na API'}`)
    } finally {
      setSendingReply(false)
    }
  }

  async function syncInbox() {
    if (!reportTarget) return
    setSyncingInbox(true)
    setSyncFeedback(null)
    try {
      // Mesma base/auth dos demais calls (api → /api/v1, header injetado pelo middleware).
      const res = await api.post<{ data: ThreadMessage[]; graph_enabled: boolean; imported: number }>(
        `/fechamento-consultor/${reportTarget.userId}/${yearMonth}/sync-inbox`,
        {},
      )
      // Atualiza a thread igual ao loadThread (consome json.data).
      setThread(res.data ?? [])
      if (res.graph_enabled === false) {
        setSyncFeedback({ kind: 'disabled', text: 'Leitura de respostas não configurada' })
      } else if (res.imported > 0) {
        setSyncFeedback({ kind: 'imported', text: `${res.imported} nova(s) resposta(s)` })
      } else {
        setSyncFeedback({ kind: 'none', text: 'Nenhuma resposta nova' })
      }
    } catch {
      setSyncFeedback({ kind: 'error', text: 'Falha ao atualizar' })
    } finally {
      setSyncingInbox(false)
    }
  }

  async function handleRelatorio(consultor: ConsultorBase | ConsultorHorista | ConsultorBancoHoras | ConsultorFixo) {
    setPrintingUser(consultor.user_id)
    try {
      const res = await api.get<{ data: ApontamentoRow[] }>(
        `/fechamento-consultor/${consultor.user_id}/${yearMonth}/apontamentos`
      )
      const html = buildReport(consultor, res.data ?? [], yearMonth)
      setReportHtml(buildFullHtml(html))
      setReportTarget({ userId: consultor.user_id, name: consultor.nome })
      setReplyBody('')
      setReplyAttach(true)
      setSyncFeedback(null)
      if (canSendEmail) void loadThread(consultor.user_id)
    } catch (err: unknown) {
      toast.error(`Erro ao gerar relatório: ${err instanceof Error ? err.message : 'falha na API'}`)
    } finally {
      setPrintingUser(null)
    }
  }

  function handlePrintTodos() {
    if (!data) return
    const todos = [
      ...data.horistas,
      ...data.banco_horas,
      ...data.fixos,
    ].sort((a, b) => a.nome.localeCompare(b.nome))

    const rowsHtml = todos.map(c => `
      <tr>
        <td>${c.nome}</td>
        <td>${c.email ?? '—'}</td>
        <td class="right">${formatBRL(c.total)}</td>
      </tr>
    `).join('')

    const totalGeral = todos.reduce((s, c) => s + c.total, 0)

    const html = `
      <div class="page">
        <div class="header">
          <div class="logo"><img src="${window.location.origin}/logo.png" alt="ERPServ Consultoria" /></div>
          <div class="meta"><strong>Fechamento de Consultores — Consolidado</strong>${fmtYearMonth(yearMonth)}</div>
        </div>
        <table>
          <thead><tr><th>Consultor</th><th>E-mail</th><th class="right">Total a Pagar</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="total-box">
          <span class="total-label">TOTAL GERAL — ${todos.length} CONSULTORES</span>
          <span class="total-value">${formatBRL(totalGeral)}</span>
        </div>
      </div>
    `
    setReportHtml(buildFullHtml(html))
    setReportTarget(null) // consolidado — sem alvo individual, esconde "Enviar e-mail"
  }

  function handlePrintResumo() {
    if (!data) return
    const { totais } = data
    const rows = [
      { label: 'Horistas',      count: data.horistas.length,    total: totais.total_horistas },
      { label: 'Banco de Horas', count: data.banco_horas.length, total: totais.total_banco_horas },
      { label: 'Fixo',          count: data.fixos.length,       total: totais.total_fixos },
    ]
    const rowsHtml = rows.map(r => `
      <tr><td>${r.label}</td><td class="right">${r.count}</td><td class="right">${formatBRL(r.total)}</td></tr>
    `).join('')
    const html = `
      <div class="page">
        <div class="header">
          <div class="logo"><img src="${window.location.origin}/logo.png" alt="ERPServ Consultoria" /></div>
          <div class="meta"><strong>Fechamento de Consultores</strong>${fmtYearMonth(yearMonth)}</div>
        </div>
        <table>
          <thead><tr><th>Tipo de Vínculo</th><th class="right">Consultores</th><th class="right">Total</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="total-box">
          <span class="total-label">TOTAL GERAL</span>
          <span class="total-value">${formatBRL(totais.total_geral)}</span>
        </div>
      </div>
    `
    setReportHtml(buildFullHtml(html))
    setReportTarget(null) // consolidado — sem alvo individual, esconde "Enviar e-mail"
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'horistas',    label: 'Horistas' },
    { key: 'banco_horas', label: 'Banco de Horas' },
    { key: 'fixo',        label: 'Fixo' },
    { key: 'resumo',      label: 'Resumo' },
  ]

  // ─── Filtros ──────────────────────────────────────────────────────────────

  function applyFilters<T extends ConsultorBase>(rows: T[]): T[] {
    let r = rows
    if (apenasComMovimento) r = r.filter(c => c.total > 0 || c.horas_trabalhadas > 0)
    if (filterNome.trim()) {
      const q = filterNome.trim().toLowerCase()
      r = r.filter(c => c.nome.toLowerCase().includes(q))
    }
    return r
  }

  // ─── Tab: Horistas ────────────────────────────────────────────────────────

  function TabHoristas() {
    const rows = applyFilters(data?.horistas ?? [])
    return (
      <div>
        <p className="text-sm text-zinc-400 mb-3">{rows.length} consultor{rows.length !== 1 ? 'es' : ''}</p>
        <Table>
          <Thead>
            <tr>
              <Th>Consultor</Th>
              <Th right>H Trabalhadas</Th>
              <Th right>H a Pagar</Th>
              <Th right>Taxa/h</Th>
              <Th right>Total</Th>
              <Th right>Relatório</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.length === 0 && (
              <Tr>
                <td colSpan={6} className="py-8 text-center text-zinc-500 text-sm">
                  Nenhum consultor horista no período
                </td>
              </Tr>
            )}
            {rows.map(c => {
              const hasGuaranteed = c.guaranteed_prorated > 0 && c.horas_a_pagar > c.horas_trabalhadas
              return (
                <Tr key={c.user_id}>
                  <Td className="font-medium text-zinc-100">{c.nome}</Td>
                  <Td right className="font-mono text-zinc-300">{fmtH(c.horas_trabalhadas)}</Td>
                  <Td right>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono text-zinc-300">{fmtH(c.horas_a_pagar)}</span>
                      {hasGuaranteed && (
                        <span className="text-[10px] font-normal text-amber-400">
                          mín {fmtH(c.guaranteed_prorated)} garantidas
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td right className="text-zinc-400">
                    {c.rate_type === 'monthly'
                      ? <span title={`Mensal: ${formatBRL(c.valor_hora)}`}>{formatBRL(c.effective_rate)}</span>
                      : formatBRL(c.effective_rate)
                    }
                  </Td>
                  <Td right className="font-semibold text-zinc-100">{formatBRL(c.total)}</Td>
                  <Td right>
                    <RelatorioBtn userId={c.user_id} printingUser={printingUser} onClick={() => handleRelatorio(c)} />
                  </Td>
                </Tr>
              )
            })}
            {rows.length > 0 && (
              <Tr className="border-t-2 border-zinc-600 bg-zinc-800/20">
                <td colSpan={4} className="py-2 px-3 text-right font-semibold text-zinc-300 text-sm">Total</td>
                <Td right className="font-bold text-violet-400">{formatBRL(data?.totais.total_horistas ?? 0)}</Td>
                <Td />
              </Tr>
            )}
          </Tbody>
        </Table>
      </div>
    )
  }

  // ─── Tab: Banco de Horas ──────────────────────────────────────────────────

  function TabBancoHoras() {
    const rows = applyFilters(data?.banco_horas ?? [])
    return (
      <div>
        <p className="text-sm text-zinc-400 mb-3">{rows.length} consultor{rows.length !== 1 ? 'es' : ''}</p>
        <Table>
          <Thead>
            <tr>
              <Th>Consultor</Th>
              <Th right>Base Mensal</Th>
              <Th right>Esperado</Th>
              <Th right>Trabalhado</Th>
              <Th right>Saldo Mês</Th>
              <Th right>Acumulado</Th>
              <Th right>H Extras</Th>
              <Th right>Total</Th>
              <Th right>Relatório</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.length === 0 && (
              <Tr>
                <td colSpan={9} className="py-8 text-center text-zinc-500 text-sm">
                  Nenhum consultor banco de horas no período
                </td>
              </Tr>
            )}
            {rows.map(c => (
              <Tr key={c.user_id}>
                <Td className="font-medium text-zinc-100">{c.nome}</Td>
                <Td right className="font-semibold text-zinc-200">{formatBRL(c.fixed_salary)}</Td>
                <Td right className="font-mono text-zinc-400">{fmtH(c.expected_hours)}</Td>
                <Td right className="font-mono text-zinc-300">{fmtH(c.horas_trabalhadas)}</Td>
                <Td right className={`font-mono ${balanceColor(c.month_balance)}`}>{fmtH(c.month_balance)}</Td>
                <Td right className={`font-mono font-semibold ${balanceColor(c.accumulated_balance)}`}>{fmtH(c.accumulated_balance)}</Td>
                <Td right className={`font-mono font-semibold ${c.horas_extras > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {c.horas_extras > 0 ? fmtH(c.horas_extras) : '—'}
                </Td>
                <Td right className="font-semibold text-zinc-100">
                  {formatBRL(c.total)}
                  {c.total_extra > 0 && (
                    <div className="text-[10px] text-emerald-400 font-normal">+{formatBRL(c.total_extra)}</div>
                  )}
                </Td>
                <Td right>
                  <RelatorioBtn userId={c.user_id} printingUser={printingUser} onClick={() => handleRelatorio(c)} />
                </Td>
              </Tr>
            ))}
            {rows.length > 0 && (
              <Tr className="border-t-2 border-zinc-600 bg-zinc-800/20">
                <td colSpan={7} className="py-2 px-3 text-right font-semibold text-zinc-300 text-sm">Total</td>
                <Td right className="font-bold text-violet-400">{formatBRL(data?.totais.total_banco_horas ?? 0)}</Td>
                <Td />
              </Tr>
            )}
          </Tbody>
        </Table>
      </div>
    )
  }

  // ─── Tab: Fixo ────────────────────────────────────────────────────────────

  function TabFixo() {
    const rows = applyFilters((data?.fixos ?? []) as ConsultorFixo[])
    return (
      <div>
        <p className="text-sm text-zinc-400 mb-3">{rows.length} consultor{rows.length !== 1 ? 'es' : ''}</p>
        <Table>
          <Thead>
            <tr>
              <Th>Consultor</Th>
              <Th right>H Trabalhadas</Th>
              <Th right>Salário Mensal</Th>
              <Th right>Relatório</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.length === 0 && (
              <Tr>
                <td colSpan={4} className="py-8 text-center text-zinc-500 text-sm">
                  Nenhum consultor fixo no período
                </td>
              </Tr>
            )}
            {rows.map(c => (
              <Tr key={c.user_id}>
                <Td className="font-medium text-zinc-100">{c.nome}</Td>
                <Td right className="font-mono text-zinc-300">{fmtH(c.horas_trabalhadas)}</Td>
                <Td right className="font-semibold text-zinc-100">{formatBRL(c.salario_mensal)}</Td>
                <Td right>
                  <RelatorioBtn userId={c.user_id} printingUser={printingUser} onClick={() => handleRelatorio(c)} />
                </Td>
              </Tr>
            ))}
            {rows.length > 0 && (
              <Tr className="border-t-2 border-zinc-600 bg-zinc-800/20">
                <td colSpan={2} className="py-2 px-3 text-right font-semibold text-zinc-300 text-sm">Total</td>
                <Td right className="font-bold text-violet-400">{formatBRL(data?.totais.total_fixos ?? 0)}</Td>
                <Td />
              </Tr>
            )}
          </Tbody>
        </Table>
      </div>
    )
  }

  // ─── Tab: Resumo ──────────────────────────────────────────────────────────

  function TabResumo() {
    const t = data?.totais
    if (!t) return null

    const tipoRows = [
      { label: 'Horistas',       count: data?.horistas.length ?? 0,    total: t.total_horistas },
      { label: 'Banco de Horas', count: data?.banco_horas.length ?? 0, total: t.total_banco_horas },
      { label: 'Fixo',           count: data?.fixos.length ?? 0,       total: t.total_fixos },
    ]

    const todos = [
      ...data!.horistas,
      ...data!.banco_horas,
      ...data!.fixos,
    ].sort((a, b) => a.nome.localeCompare(b.nome))
    // Lista individual respeita os filtros (busca por nome + "com movimentos").
    const todosFiltrados = applyFilters(todos as ConsultorBase[])
    const totalFiltrado = todosFiltrados.reduce((s, c) => s + (c.total ?? 0), 0)

    return (
      <div className="space-y-6">
        {/* Tabela por tipo */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Por tipo de vínculo</p>
            <button
              onClick={handlePrintResumo}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              <Printer size={12} /> Imprimir
            </button>
          </div>
          <Table>
            <Thead>
              <tr>
                <Th>Tipo de Vínculo</Th>
                <Th right>Consultores</Th>
                <Th right>Total</Th>
              </tr>
            </Thead>
            <Tbody>
              {tipoRows.map(r => (
                <Tr key={r.label}>
                  <Td>{r.label}</Td>
                  <Td right className="text-zinc-400">{r.count}</Td>
                  <Td right className="font-mono text-zinc-200">{formatBRL(r.total)}</Td>
                </Tr>
              ))}
              <Tr className="border-t-2 border-[#7C3AED]" baseBackground="rgba(124,58,237,0.06)">
                <Td style={{ color: '#6D28D9', fontWeight: 700 }}>Total Geral</Td>
                <Td right style={{ color: '#6D28D9', fontWeight: 600 }}>{todos.length}</Td>
                <Td right className="text-base" style={{ color: '#6D28D9', fontWeight: 700 }}>{formatBRL(t.total_geral)}</Td>
              </Tr>
            </Tbody>
          </Table>
        </div>

        {/* Lista individual de todos os consultores */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
              Todos os consultores ({todosFiltrados.length})
            </p>
            <button
              onClick={handlePrintTodos}
              className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              <Printer size={12} /> Imprimir lista
            </button>
          </div>
          <Table>
            <Thead>
              <tr>
                <Th>Consultor</Th>
                <Th>E-mail</Th>
                <Th right>Total a Pagar</Th>
              </tr>
            </Thead>
            <Tbody>
              {todosFiltrados.map(c => (
                <Tr key={c.user_id}>
                  <Td className="font-medium text-zinc-100">{c.nome}</Td>
                  <Td className="text-zinc-400">{c.email ?? '—'}</Td>
                  <Td right className="font-semibold text-zinc-100">{formatBRL(c.total)}</Td>
                </Tr>
              ))}
              <Tr className="border-t-2 border-zinc-600 bg-zinc-800/20">
                <td colSpan={2} className="py-2 px-3 text-right font-semibold text-zinc-300 text-sm">Total</td>
                <Td right className="font-bold text-violet-400">{formatBRL(totalFiltrado)}</Td>
              </Tr>
            </Tbody>
          </Table>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout title="Fechamento — Consultores">
      <div className="space-y-6">

        <PageHeader
          icon={Users}
          title="Fechamento de Consultores"
          subtitle={`Custo mensal por tipo de vínculo — ${fmtYearMonth(yearMonth)}`}
          actions={
            <div className="flex items-center gap-3">
              <input
                type="month"
                value={yearMonth}
                onChange={e => setYearMonth(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <Button size="sm" variant="secondary" onClick={load} disabled={loading} icon={RefreshCw} loading={loading}>
                Atualizar
              </Button>
            </div>
          }
        />

        {/* Summary cards */}
        {data && !loading && (() => {
          const totalCount = data.horistas.length + data.banco_horas.length + data.fixos.length
          const totalValor = data.totais.total_geral
          const breakdown = [
            { key: 'horistas',  label: 'Horistas',      valor: data.totais.total_horistas,    count: data.horistas.length },
            { key: 'bh',        label: 'Banco de Horas', valor: data.totais.total_banco_horas, count: data.banco_horas.length },
            { key: 'fixo',      label: 'Fixo',          valor: data.totais.total_fixos,       count: data.fixos.length },
          ]
          const pct = (v: number) => totalValor > 0 ? Math.round((v / totalValor) * 100) : 0
          const maior = breakdown.reduce((a, b) => b.valor > a.valor ? b : a)
          const mediaPorConsultor = totalCount > 0 ? totalValor / totalCount : 0

          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Cards menores (3 vínculos) — neutros via tokens */}
              <div className="grid grid-cols-3 lg:col-span-2 gap-3">
                {breakdown.map(b => (
                  <div key={b.key} className="rounded-xl p-4 border" style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    boxShadow: 'var(--brand-card-shadow)',
                  }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{b.label}</div>
                    <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>{formatBRL(b.valor)}</div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span style={{ color: 'var(--text-light)' }}>{b.count} consultor{b.count !== 1 ? 'es' : ''}</span>
                      <span className="font-semibold" style={{ color: 'var(--primary)' }}>{pct(b.valor)}%</span>
                    </div>
                    {/* Barra de % */}
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-hover)' }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${pct(b.valor)}%`,
                        background: 'var(--primary)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Card destaque — Total Geral roxo sólido + breakdown rápido */}
              <div className="rounded-xl p-5 relative overflow-hidden" style={{
                background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 60%, #8B5CF6 100%)',
                color: '#FFFFFF',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.25)',
              }}>
                <div className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Total Geral</div>
                <div className="text-3xl font-bold tracking-tight">{formatBRL(totalValor)}</div>
                <div className="text-xs opacity-85 mt-1 mb-3">
                  {totalCount} consultor{totalCount !== 1 ? 'es' : ''} · {maior.label} lidera ({pct(maior.valor)}%)
                </div>
                <div className="pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'rgba(255,255,255,0.20)' }}>
                  <div>
                    <div className="opacity-75">Média/consultor</div>
                    <div className="font-bold mt-0.5">{formatBRL(mediaPorConsultor)}</div>
                  </div>
                  <div className="text-right">
                    <div className="opacity-75">Tipos com movimento</div>
                    <div className="font-bold mt-0.5">{breakdown.filter(b => b.count > 0).length} de {breakdown.length}</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Tabs */}
        <div className="border-b flex gap-1" style={{ borderColor: 'var(--border)' }}>
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-4 py-2 text-sm border-b-2 transition-colors"
                style={{
                  borderColor: active ? 'var(--primary)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 500,
                  marginBottom: '-1px',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border text-xs font-semibold" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setApenasComMovimento(true)}
              className="px-3 py-1.5 transition-colors"
              style={apenasComMovimento
                ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                : { background: 'var(--surface)', color: 'var(--text-muted)' }}
            >
              Com movimentos
            </button>
            <button
              onClick={() => setApenasComMovimento(false)}
              className="px-3 py-1.5 transition-colors"
              style={!apenasComMovimento
                ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                : { background: 'var(--surface)', color: 'var(--text-muted)' }}
            >
              Todos
            </button>
          </div>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar consultor..."
              value={filterNome}
              onChange={e => setFilterNome(e.target.value)}
              className="w-full rounded-lg pl-8 pr-7 py-1.5 text-xs focus:outline-none ds-input"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            {filterNome && (
              <button onClick={() => setFilterNome('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--text-muted)' }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[200px]">
          {loading ? (
            <SkeletonTable rows={5} cols={5} />
          ) : !data ? (
            <EmptyState icon={FileText} title="Nenhum dado" description="Selecione um período para visualizar o fechamento." />
          ) : (
            <>
              {tab === 'horistas'    && <TabHoristas />}
              {tab === 'banco_horas' && <TabBancoHoras />}
              {tab === 'fixo'        && <TabFixo />}
              {tab === 'resumo'      && <TabResumo />}
            </>
          )}
        </div>

      </div>
      {/* Modal de visualização do relatório */}
      {reportHtml && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.85)', paddingTop: 'var(--banner-h, 0px)' }}>
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: '#18181b', borderBottom: '1px solid #3f3f46' }}>
            <span className="text-sm font-semibold text-white">Relatório</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => reportIframeRef.current?.contentWindow?.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: 'var(--brand-primary)', color: 'var(--primary-fg)' }}
              >
                <Printer size={12} /> Imprimir
              </button>
              {canSendEmail && reportTarget && (
                <button
                  onClick={sendReportEmail}
                  disabled={sendingEmail}
                  title={`Enviar para ${reportTarget.name} (cópia financeiro)`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  style={{ background: 'var(--success)', color: 'var(--primary-fg)' }}
                >
                  <Mail size={12} /> {sendingEmail ? 'Enviando…' : 'Enviar e-mail'}
                </button>
              )}
              <button
                onClick={() => { setReportHtml(null); setReportTarget(null); setThread([]); setReplyBody('') }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                Fechar
              </button>
            </div>
          </div>
          <div className="flex-1 flex min-h-0">
            <iframe
              ref={reportIframeRef}
              srcDoc={reportHtml}
              className="flex-1 h-full"
              style={{ background: '#fff', border: 'none' }}
            />
            {canSendEmail && reportTarget && (
              <ConversaPanel
                thread={thread}
                loading={threadLoading}
                reportHtml={reportHtml}
                replyBody={replyBody}
                onReplyBody={setReplyBody}
                replyAttach={replyAttach}
                onReplyAttach={setReplyAttach}
                sending={sendingReply}
                onSend={sendContinuation}
                onSync={syncInbox}
                syncing={syncingInbox}
                syncFeedback={syncFeedback}
              />
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
