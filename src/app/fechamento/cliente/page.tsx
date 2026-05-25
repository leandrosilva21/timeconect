'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { api } from '@/lib/api'
import { formatBRL } from '@/lib/format'
import { MonthYearPicker } from '@/components/ui/month-year-picker'
import { SearchSelect } from '@/components/ui/search-select'
import { useAuth } from '@/hooks/use-auth'
import { usePersistedFilters } from '@/hooks/use-persisted-filters'
import { toast } from 'sonner'
import { Lock, RefreshCw, Building2, Printer, FileText, Receipt, ChevronRight, ChevronDown, Mail, FileSpreadsheet, Send, X, Save, Plus, Check } from 'lucide-react'
import {
  Table, Thead, Th, Tbody, Tr, Td,
  Badge, Button, SkeletonTable, EmptyState,
} from '@/components/ds'
import Image from 'next/image'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ClienteStatus {
  customer_id: number
  nome: string
  status: 'open' | 'closed' | 'sem_registro'
  total_servicos: number
  total_despesas: number
  total_geral: number
  closed_at?: string
  closed_by_name?: string
  envio_em?: string | null   // ISO do último envio por e-mail; null = não enviado
  envio_por?: string | null  // nome de quem enviou
}

interface ApontamentoRow {
  id: number
  data: string
  colaborador: string
  horas: number
  ticket?: string
  titulo?: string
  solicitante?: string
  observacao?: string
  client_extra_pct?: number | null
  valor_extra?: number | null
  // Sub-projeto real do apontamento. Quando um contrato On Demand pai consolida
  // projetos-filho, as linhas do pai trazem o código do pai e as do filho o
  // código do filho (ex: VDM004-23-01) — usado para separar em sub-blocos.
  sub_projeto_id?: number
  sub_projeto_codigo?: string
  sub_projeto_nome?: string
}

interface ProjetoRow {
  projeto_id: number
  projeto_nome: string
  projeto_codigo: string
  tipo_contrato: string
  horas: number
  valor_hora: number
  total_receita: number
  extra_receita?: number
  apontamentos: ApontamentoRow[]
}

interface ApontamentosData {
  projetos: ProjetoRow[]
  total_horas: number
  total_geral: number
}

interface DespesaRow {
  id: number
  data: string
  descricao: string
  categoria: string
  colaborador: string
  projeto: string
  valor: number
}

// Apuração por Ticket (Vedamotors) — espelha /timesheets/summary-by-ticket.
interface TicketSummaryRow {
  ticket: string
  title: string | null
  requester: string | null
  period_minutes: number
  lifetime_minutes: number
}

// Estrutura mínima do /fechamento-contrato (on_demand only)
interface ProjetoGlobal { projeto_id: number; nome: string; codigo: string; horas: number; valor_hora: number; total_receita: number }
interface ClienteGlobal  { customer_id: number; nome: string; projetos: ProjetoGlobal[]; total_horas: number; total_receita: number }
interface GlobalData     { tipos: { code: string; nome: string; clientes: ClienteGlobal[]; total_clientes: number; total_horas: number; total_receita: number }[]; total_geral: number }

type Tab = 'global' | 'servicos' | 'relatorio' | 'despesas'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toYearMonth(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function fmtYM(ym: string): string {
  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const [y, m] = ym.split('-')
  return `${MONTHS[parseInt(m) - 1]}/${y}`
}

function fmtYMFull(ym: string): string {
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const [y, m] = ym.split('-')
  return `${MONTHS[parseInt(m) - 1]} / ${y}`
}

function fmtPeriodo(from: string, to: string): string {
  if (!from || !to) return ''
  return from === to ? fmtYM(to) : `${fmtYM(from)} — ${fmtYM(to)}`
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const now = new Date()

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FechamentoClientePage() {
  const { user } = useAuth()
  const isAdmin = (user as any)?.type === 'admin'

  const { filters: flt, set: setFilter } = usePersistedFilters(
    'fechamento_cliente',
    user?.id,
    {
      fromMonth:    now.getMonth() + 1 as number | null,
      fromYear:     now.getFullYear() as number | null,
      toMonth:      now.getMonth() + 1 as number | null,
      toYear:       now.getFullYear() as number | null,
      customerId:   null as number | null,
      projetoFilter: null as number | null,
      tab:          'servicos' as Tab,
    },
  )
  const { fromMonth, fromYear, toMonth, toYear, customerId, projetoFilter, tab } = flt
  const setFromMonth     = (v: number | null) => setFilter('fromMonth', v)
  const setFromYear      = (v: number | null) => setFilter('fromYear', v)
  const setToMonth       = (v: number | null) => setFilter('toMonth', v)
  const setToYear        = (v: number | null) => setFilter('toYear', v)
  const setCustomerId    = (v: number | null) => setFilter('customerId', v)
  const setProjetoFilter = (v: number | null) => setFilter('projetoFilter', v)
  const setTab           = (v: Tab)           => setFilter('tab', v)

  // ── Período ──
  const fromYM = fromMonth && fromYear ? toYearMonth(fromMonth, fromYear) : ''
  const toYM   = toMonth   && toYear   ? toYearMonth(toMonth,   toYear)   : ''
  const isSingleMonth = fromYM !== '' && fromYM === toYM

  // ── Seleção de cliente ──
  const [clientes, setClientes]     = useState<ClienteStatus[]>([])
  const [status, setStatus]         = useState<ClienteStatus | null>(null)

  // ── Dados ──
  const [globalData,      setGlobalData]      = useState<GlobalData | null>(null)
  const [loadingGlobal,   setLoadingGlobal]   = useState(false)
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set())

  const [dados,    setDados]    = useState<ApontamentosData | null>(null)
  const [despesas, setDespesas] = useState<DespesaRow[]>([])
  // Apuração por Ticket — só preenchido para Vedamotors.
  // O valor (ticketSummary) só era lido pelo HTML client-side do relatório, que agora
  // vem do backend; o setter segue alimentado pelos loaders/efeitos para não mexer
  // na máquina de carregamento existente.
  const [, setTicketSummary] = useState<TicketSummaryRow[]>([])

  const [loading,         setLoading]         = useState(false)
  const [loadingDespesas, setLoadingDespesas] = useState(false)
  const [loadingFechar,   setLoadingFechar]   = useState(false)
  const [loadingReabrir,  setLoadingReabrir]  = useState(false)

  // ── Relatório (preview em iframe) / envio de e-mail ─────────────────────────
  const canSendEmail = (user as any)?.type === 'admin' || (user as any)?.type === 'administrativo'
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const reportIframeRef = useRef<HTMLIFrameElement>(null)

  // HTML do relatório vem do backend (mesma Blade do PDF enviado por e-mail) — o
  // preview na tela e o PDF anexado ficam byte-idênticos pois nascem da mesma fonte.
  const [reportHtml, setReportHtml] = useState<string | null>(null)
  const [reportHtmlLoading, setReportHtmlLoading] = useState(false)

  // Dialog de composição/preview do e-mail.
  const [composeOpen, setComposeOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [limpandoEnvio, setLimpandoEnvio] = useState(false)
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null)
  const [emailMensagem, setEmailMensagem] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  // Destinatários — clientes não têm admin fixos, só cadastrados + avulsos.
  const [cadastradoInput, setCadastradoInput] = useState('')            // e-mails do cliente (cadastrados), separados por vírgula
  const [savingCadastro, setSavingCadastro] = useState(false)
  const [cadastroSaved, setCadastroSaved] = useState(false)
  const [avulsoEmails, setAvulsoEmails] = useState<string[]>([])        // e-mails avulsos (só deste envio)
  const [avulsoDraft, setAvulsoDraft] = useState('')
  // true só no primeiro fetch (sem mensagem) — usado pra semear o textarea com o padrão.
  const previewSeededRef = useRef(false)
  // True só quando o press (mousedown) começou no próprio backdrop do compose.
  const composePressOnBackdrop = useRef(false)

  // ── Loaders ──

  const loadClientes = useCallback(() => {
    if (!toYM) return
    api.get<{ data: ClienteStatus[] }>(`/fechamento-cliente?year_month=${toYM}`)
      .then(r => {
        setClientes(r.data ?? [])
        if (customerId) {
          setStatus(r.data?.find(c => c.customer_id === customerId) ?? null)
        }
      })
      .catch(() => {})
  }, [toYM, customerId])

  const loadGlobal = useCallback(() => {
    if (!toYM) return
    setLoadingGlobal(true)
    api.get<{ data: GlobalData }>(`/fechamento-contrato?year_month=${toYM}`)
      .then(r => setGlobalData(r.data ?? null))
      .catch(() => {})
      .finally(() => setLoadingGlobal(false))
  }, [toYM])

  const loadServicos = useCallback(() => {
    if (!customerId || !fromYM || !toYM) return
    setLoading(true)
    const params = new URLSearchParams({ from: fromYM, to: toYM })
    api.get<{ data: ApontamentosData }>(`/fechamento-cliente/${customerId}/${toYM}/apontamentos?${params}`)
      .then(r => setDados(r.data ?? null))
      .catch(() => toast.error('Erro ao carregar apontamentos'))
      .finally(() => setLoading(false))
  }, [customerId, fromYM, toYM])

  const loadDespesas = useCallback(() => {
    if (!customerId || !fromYM || !toYM) return
    setLoadingDespesas(true)
    const params = new URLSearchParams({ from: fromYM, to: toYM })
    api.get<{ data: DespesaRow[] }>(`/fechamento-cliente/${customerId}/${toYM}/despesas?${params}`)
      .then(r => setDespesas(r.data ?? []))
      .catch(() => toast.error('Erro ao carregar despesas'))
      .finally(() => setLoadingDespesas(false))
  }, [customerId, fromYM, toYM])

  // Apuração por Ticket — só Vedamotors. Espelha o relatório de apontamentos:
  // GET /timesheets/summary-by-ticket com customer_id + start_date/end_date.
  // O fechamento trabalha com ano-mês (fromYM/toYM); converte pra dia inicial
  // do fromYM e dia final do toYM. Statuses pending+approved (escopo do relatório).
  const loadTicketSummary = useCallback(() => {
    if (!customerId || !fromYM || !toYM) { setTicketSummary([]); return }
    const nome = clientes.find(c => c.customer_id === customerId)?.nome ?? ''
    if (!nome.toUpperCase().includes('VEDAMOTORS')) { setTicketSummary([]); return }

    const startDate = `${fromYM}-01`
    const [ty, tm] = toYM.split('-').map(Number)
    const lastDay = new Date(ty, tm, 0).getDate()
    const endDate = `${toYM}-${String(lastDay).padStart(2, '0')}`

    const p = new URLSearchParams()
    p.set('customer_id', String(customerId))
    p.set('start_date',  startDate)
    p.set('end_date',    endDate)
    ;['pending', 'approved'].forEach(s => p.append('status[]', s))

    api.get<{ tickets?: TicketSummaryRow[] }>(`/timesheets/summary-by-ticket?${p}`)
      .then(r => {
        const tickets = Array.isArray(r?.tickets) ? r.tickets : []
        tickets.sort((a, b) => a.ticket.localeCompare(b.ticket, 'pt-BR', { numeric: true }))
        setTicketSummary(tickets)
      })
      .catch(() => setTicketSummary([]))
  }, [customerId, fromYM, toYM, clientes])

  // ── Efeitos ──

  // "Até" vazio mas "De" preenchido → default "Até" = "De" (fechamento de mês único).
  // Sem isso, as listas que dependem de toYM (clientes, visão global) ficam vazias.
  useEffect(() => {
    if (fromMonth && fromYear && (toMonth == null || toYear == null)) {
      setToMonth(fromMonth)
      setToYear(fromYear)
    }
  }, [fromMonth, fromYear, toMonth, toYear])

  useEffect(() => {
    loadClientes()
    loadGlobal()
    setDados(null)
    setDespesas([])
    setTicketSummary([])
    setProjetoFilter(null)
  }, [fromYM, toYM])

  useEffect(() => {
    if (!customerId) { setStatus(null); setDados(null); setDespesas([]); setTicketSummary([]); return }
    setStatus(clientes.find(c => c.customer_id === customerId) ?? null)
    setDados(null)
    setDespesas([])
    setTicketSummary([])
    setProjetoFilter(null)
    // NÃO troca de aba ao mudar o cliente — o seletor filtra a Visão Global; o usuário
    // escolhe a aba (Relatório/Apontamentos) quando quiser.
  }, [customerId, clientes])

  useEffect(() => {
    if (customerId && fromYM && toYM) {
      loadServicos()
      loadDespesas()
      loadTicketSummary()
    }
  }, [customerId, fromYM, toYM, clientes])

  // ── Fechar / Reabrir ──

  const handleFechar = () => {
    if (!customerId || !toYM) return
    setLoadingFechar(true)
    api.post(`/fechamento-cliente/${customerId}/${toYM}/fechar`, {})
      .then(() => { toast.success('Fechamento encerrado!'); loadClientes() })
      .catch(() => toast.error('Erro ao fechar'))
      .finally(() => setLoadingFechar(false))
  }

  const handleReabrir = () => {
    if (!customerId || !toYM) return
    setLoadingReabrir(true)
    api.post(`/fechamento-cliente/${customerId}/${toYM}/reabrir`, {})
      .then(() => {
        toast.success('Fechamento reaberto.')
        setDados(null)
        setDespesas([])
        loadClientes()
        loadServicos()
        loadDespesas()
      })
      .catch(() => toast.error('Erro ao reabrir'))
      .finally(() => setLoadingReabrir(false))
  }

  // ── Imprimir ──

  const handlePrint = (target: 'servicos' | 'despesas') => {
    document.body.setAttribute('data-print', target)
    window.print()
    setTimeout(() => document.body.removeAttribute('data-print'), 500)
  }

  // ── Excel / E-mail ──────────────────────────────────────────────────────────

  async function downloadExcel() {
    if (!customerId || !toYM) return
    setDownloadingExcel(true)
    try {
      // O `api` helper sempre faz res.json(); pra blob usamos fetch direto no
      // mesmo proxy /api/v1 (o middleware injeta o Authorization via cookie).
      const res = await fetch(
        `/api/v1/fechamento-cliente/${customerId}/${toYM}/excel`,
        { credentials: 'same-origin', headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } },
      )
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
      const fallback = `Fechamento_${toYM}_${clienteNome || 'cliente'}.xlsx`
      const filename = match ? decodeURIComponent(match[1]) : fallback
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      toast.error(`Erro ao baixar o Excel: ${err instanceof Error ? err.message : 'falha na API'}`)
    } finally {
      setDownloadingExcel(false)
    }
  }

  // Busca o HTML renderizado do e-mail. Sem `mensagem` → backend devolve o html
  // padrão + `mensagem_padrao` (semeia o textarea) + e-mails cadastrados.
  // Clientes não têm admin fixos, então não há lista de e-mails fixos.
  const fetchEmailPreview = useCallback(async (mensagem?: string) => {
    if (!customerId || !toYM) return
    setPreviewLoading(true)
    try {
      const res = await api.post<{
        html: string
        mensagem_padrao: string
        fechamento_email: string | null
      }>(
        `/fechamento-cliente/${customerId}/${toYM}/email-preview`,
        mensagem !== undefined ? { mensagem } : {},
      )
      setEmailPreviewHtml(res.html)
      if (!previewSeededRef.current) {
        previewSeededRef.current = true
        setEmailMensagem(res.mensagem_padrao ?? '')
        setCadastradoInput(res.fechamento_email ?? '')
      }
    } catch (err: unknown) {
      toast.error(`Erro ao gerar a prévia do e-mail: ${err instanceof Error ? err.message : 'falha na API'}`)
    } finally {
      setPreviewLoading(false)
    }
  }, [customerId, toYM])

  function openCompose() {
    if (!customerId || !toYM) return
    previewSeededRef.current = false
    setEmailMensagem('')
    setEmailPreviewHtml(null)
    setCadastradoInput('')
    setAvulsoEmails([])
    setAvulsoDraft('')
    setCadastroSaved(false)
    setComposeOpen(true)
    void fetchEmailPreview() // primeiro fetch: sem mensagem → html + mensagem_padrao + e-mails
  }

  function closeCompose() {
    setComposeOpen(false)
    setEmailPreviewHtml(null)
    setEmailMensagem('')
    setCadastradoInput('')
    setAvulsoEmails([])
    setAvulsoDraft('')
    setCadastroSaved(false)
    previewSeededRef.current = false
  }

  // Live update do preview: ao editar a mensagem, faz debounce (~450ms) e re-busca
  // o html. Só dispara depois que o primeiro fetch semeou o textarea.
  useEffect(() => {
    if (!composeOpen || !previewSeededRef.current) return
    const t = setTimeout(() => { void fetchEmailPreview(emailMensagem) }, 450)
    return () => clearTimeout(t)
  }, [emailMensagem, composeOpen, fetchEmailPreview])

  // Adiciona um e-mail avulso (chip) só deste envio. Aceita Enter / vírgula.
  function addAvulso() {
    const v = avulsoDraft.trim().replace(/,$/, '').trim()
    if (!v) return
    setAvulsoEmails(prev => prev.includes(v) ? prev : [...prev, v])
    setAvulsoDraft('')
  }

  function removeAvulso(email: string) {
    setAvulsoEmails(prev => prev.filter(e => e !== email))
  }

  // Salva os e-mails cadastrados no cliente (persiste no cadastro).
  async function saveCadastro() {
    if (!customerId) return
    setSavingCadastro(true)
    setCadastroSaved(false)
    try {
      const res = await api.post<{ success: boolean; fechamento_email: string }>(
        `/fechamento-cliente/${customerId}/fechamento-email`,
        { fechamento_email: cadastradoInput },
      )
      setCadastradoInput(res.fechamento_email ?? cadastradoInput)
      setCadastroSaved(true)
      toast.success('E-mails salvos no cadastro do cliente.')
    } catch (err: unknown) {
      toast.error(`Erro ao salvar os e-mails: ${err instanceof Error ? err.message : 'falha na API'}`)
    } finally {
      setSavingCadastro(false)
    }
  }

  async function sendReportEmail() {
    if (!customerId || !toYM) return
    // Destinatários = cadastrados (split por vírgula) + avulsos, trim + dedupe.
    const cadastrados = cadastradoInput.split(',').map(e => e.trim()).filter(Boolean)
    const emails = Array.from(new Set([...cadastrados, ...avulsoEmails]))
    setSendingEmail(true)
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        `/fechamento-cliente/${customerId}/${toYM}/enviar-email`,
        { mensagem: emailMensagem, emails },
      )
      toast.success(res?.message ?? 'Fechamento enviado por e-mail.')
      patchEnvio(customerId, new Date().toISOString(), (user as any)?.name ?? null)
      closeCompose()
    } catch (err: unknown) {
      toast.error(`Erro ao enviar o fechamento: ${err instanceof Error ? err.message : 'falha na API'}`)
    } finally {
      setSendingEmail(false)
    }
  }

  // Atualiza o status de envio do cliente (otimista, sem refetch) — em `status` e na lista.
  function patchEnvio(id: number | null, envio_em: string | null, envio_por: string | null) {
    if (!id) return
    setStatus(prev => (prev && prev.customer_id === id ? { ...prev, envio_em, envio_por } : prev))
    setClientes(prev => prev.map(c => (c.customer_id === id ? { ...c, envio_em, envio_por } : c)))
  }

  async function limparEnvio() {
    if (!customerId || !toYM) return
    setLimpandoEnvio(true)
    try {
      await api.post(`/fechamento-cliente/${customerId}/${toYM}/limpar-envio`, {})
      patchEnvio(customerId, null, null)
      toast.success('Status de envio limpo.')
    } catch (err: unknown) {
      toast.error(`Erro ao limpar: ${err instanceof Error ? err.message : 'falha na API'}`)
    } finally {
      setLimpandoEnvio(false)
    }
  }

  // ── Toggle expansão de cliente na visão global ──
  const toggleClient = (id: number) => setExpandedClients(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // ── Derivados ──

  const isClosed       = status?.status === 'closed'
  const clienteOptions = clientes.map(c => ({ id: c.customer_id, name: c.nome }))
  const todosProjetos  = dados?.projetos ?? []
  const projetoOptions = todosProjetos.map(p => ({ id: p.projeto_id, name: `${p.projeto_codigo} — ${p.projeto_nome}` }))
  const projetos       = projetoFilter ? todosProjetos.filter(p => p.projeto_id === projetoFilter) : todosProjetos
  const totalHoras     = projetos.reduce((s, p) => s + p.horas, 0)
  const totalGeral     = projetos.reduce((s, p) => s + p.total_receita, 0)
  const totalDespesas  = despesas.reduce((s, d) => s + d.valor, 0)
  const clienteNome    = clientes.find(c => c.customer_id === customerId)?.nome ?? ''
  const periodo        = fmtPeriodo(fromYM, toYM)

  // Relatório — busca o HTML standalone do backend (mesma Blade do PDF). Reseta ao
  // trocar cliente/competência pra não exibir um relatório defasado durante o fetch.
  // As escritas de estado ficam dentro do fluxo async (não no corpo síncrono do
  // efeito) e são guardadas por `cancelled` para corridas entre cliente/competência.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setReportHtml(null)
      if (tab !== 'relatorio' || !customerId || projetos.length === 0) return
      setReportHtmlLoading(true)
      try {
        const res = await api.get<{ html: string }>(`/fechamento-cliente/${customerId}/${toYM}/report-html`)
        if (!cancelled) setReportHtml(res.html)
      } catch {
        if (!cancelled) { setReportHtml(null); toast.error('Erro ao gerar o relatório') }
      } finally {
        if (!cancelled) setReportHtmlLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [tab, customerId, toYM, projetos.length])

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppLayout title="Fechamento On Demand">
      {/* Estilos de impressão */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          body[data-print="servicos"] #print-servicos,
          body[data-print="servicos"] #print-servicos * { visibility: visible !important; }
          body[data-print="servicos"] #print-servicos { position: fixed; top: 0; left: 0; width: 100%; z-index: 9999; }
          body[data-print="despesas"] #print-despesas,
          body[data-print="despesas"] #print-despesas * { visibility: visible !important; }
          body[data-print="despesas"] #print-despesas { position: fixed; top: 0; left: 0; width: 100%; z-index: 9999; }
        }
        #print-servicos, #print-despesas {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      `}</style>

      <div className="flex-1 flex flex-col min-h-0 overflow-auto">

        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--brand-border)' }}>
          <div className="flex flex-wrap items-center gap-3">
            <Building2 size={20} style={{ color: 'var(--brand-primary)' }} />
            <h1 className="text-lg font-semibold" style={{ color: 'var(--brand-text)' }}>
              Fechamento On Demand
            </h1>
            {periodo && (
              <span className="text-sm" style={{ color: 'var(--brand-muted)' }}>{periodo}</span>
            )}
            {isClosed && isSingleMonth && (
              <Badge variant="success"><Lock size={10} className="mr-1" />FECHADO</Badge>
            )}
            {status?.status === 'open' && isSingleMonth && (
              <Badge variant="warning">ABERTO</Badge>
            )}
          </div>

          {/* Controles: período + cliente + contrato */}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            {/* Pickers De/Até */}
            <div className="flex items-center gap-2">
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--brand-muted)' }}>De</div>
                <MonthYearPicker
                  month={fromMonth}
                  year={fromYear}
                  onChange={(m, y) => {
                    setFromMonth(m || null)
                    setFromYear(y || null)
                    // Garante que toYM >= fromYM
                    if (m && y && toYear && toMonth) {
                      const fYM = toYearMonth(m, y)
                      const tYM = toYearMonth(toMonth, toYear)
                      if (fYM > tYM) { setToMonth(m); setToYear(y) }
                    }
                  }}
                />
              </div>
              <span className="text-sm pb-1" style={{ color: 'var(--brand-subtle)' }}>—</span>
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--brand-muted)' }}>Até</div>
                <MonthYearPicker
                  month={toMonth}
                  year={toYear}
                  onChange={(m, y) => { setToMonth(m || null); setToYear(y || null) }}
                />
              </div>
            </div>

            {/* Filtro de contrato (projeto) */}
            {projetoOptions.length > 0 && (
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--brand-muted)' }}>Contrato</div>
                <SearchSelect
                  value={projetoFilter ?? ''}
                  onChange={v => setProjetoFilter(v ? Number(v) : null)}
                  options={projetoOptions}
                  placeholder="Todos os contratos"
                />
              </div>
            )}

            {/* Cliente */}
            <div className="ml-auto flex items-end gap-2 flex-wrap">
              <SearchSelect
                value={customerId ?? ''}
                onChange={v => setCustomerId(v ? Number(v) : null)}
                options={clienteOptions}
                placeholder="Selecionar cliente..."
              />
              {isAdmin && customerId && isSingleMonth && !isClosed && (
                <Button size="sm" onClick={handleFechar} disabled={loadingFechar}
                  style={{ background: 'var(--brand-primary)', color: '#000' }}>
                  {loadingFechar ? <RefreshCw size={12} className="animate-spin" /> : <Lock size={12} />}
                  <span className="ml-1">Fechar</span>
                </Button>
              )}
              {isAdmin && isClosed && isSingleMonth && (
                <Button size="sm" variant="secondary" onClick={handleReabrir} disabled={loadingReabrir}>
                  {loadingReabrir ? <RefreshCw size={12} className="animate-spin" /> : null}
                  Reabrir
                </Button>
              )}
            </div>
          </div>

          {isClosed && isSingleMonth && status && (
            <div className="mt-3 px-3 py-2 rounded text-xs"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--brand-muted)', border: '1px solid var(--brand-border)' }}>
              Dados históricos — fechado em {new Date(status.closed_at!).toLocaleDateString('pt-BR')}
              {status.closed_by_name ? ` por ${status.closed_by_name}` : ''}
            </div>
          )}
        </div>

        {/* ── Tabs — sempre visíveis ── */}
        <div className="flex gap-1 px-6 border-b" style={{ borderColor: 'var(--brand-border)' }}>
          {([
            { key: 'global',    label: 'Visão Global' },
            { key: 'servicos',  label: 'Apontamentos' },
            { key: 'relatorio', label: 'Relatório Serviços' },
            { key: 'despesas',  label: `Despesas${despesas.length > 0 ? ` (${despesas.length})` : ''}` },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                color: tab === t.key ? 'var(--brand-primary)' : 'var(--brand-muted)',
                borderBottom: tab === t.key ? '2px solid var(--brand-primary)' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-6">

          {/* ── Tab Visão Global ── */}
          {tab === 'global' && (() => {
            if (loadingGlobal) return <SkeletonTable rows={6} cols={4} />

            // Agrega TODOS os tipos → um mapa por cliente com todos os projetos
            // total_receita na visão global = horas × valor_hora (não a mensalidade contratada)
            type ProjDisp = ProjetoGlobal & { tipo_nome: string; tipo_code: string; total_display: number }
            type ClienteAgg = { customer_id: number; nome: string; projetos: ProjDisp[]; total_horas: number; total_receita: number }
            const clientMap = new Map<number, ClienteAgg>()
            ;(globalData?.tipos ?? []).forEach(tipo => {
              tipo.clientes.forEach(c => {
                if (!clientMap.has(c.customer_id)) {
                  clientMap.set(c.customer_id, { customer_id: c.customer_id, nome: c.nome, projetos: [], total_horas: 0, total_receita: 0 })
                }
                const entry = clientMap.get(c.customer_id)!
                c.projetos.forEach(p => {
                  const display = Math.round(p.horas * p.valor_hora * 100) / 100
                  if (p.horas > 0) {
                    entry.projetos.push({ ...p, tipo_nome: tipo.nome, tipo_code: tipo.code, total_display: display })
                    entry.total_horas   += p.horas
                    entry.total_receita += display
                  }
                })
              })
            })
            const lista = Array.from(clientMap.values())
              .filter(c => c.total_receita > 0)
              .filter(c => !customerId || c.customer_id === customerId) // seletor filtra a Visão Global
              .sort((a, b) => a.nome.localeCompare(b.nome))

            if (lista.length === 0) {
              return (
                <EmptyState icon={Building2} title="Sem movimento no período"
                  description="Nenhum cliente com apontamentos no período selecionado." />
              )
            }
            const totalHoras   = lista.reduce((s, c) => s + c.total_horas, 0)
            const totalReceita = lista.reduce((s, c) => s + c.total_receita, 0)
            const statusMap = new Map(clientes.map(c => [c.customer_id, c.status]))
            return (
              <div>
                {/* Cards de resumo */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="rounded-xl p-4" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--brand-muted)' }}>Clientes com movimento</div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--brand-text)' }}>{lista.length}</div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--brand-muted)' }}>Horas Aprovadas</div>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--brand-text)' }}>
                      {totalHoras.toFixed(2)}h
                    </div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--brand-muted)' }}>Total Geral</div>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--brand-primary)' }}>
                      {formatBRL(totalReceita)}
                    </div>
                  </div>
                </div>

                {/* Tabela apenas com quem tem movimento */}
                <Table>
                  <Thead>
                    <tr>
                      <Th>Cliente / Projeto</Th>
                      <Th>Status</Th>
                      <Th right>Horas</Th>
                      <Th right>Valor/h</Th>
                      <Th right>Total Serviços</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {lista.map(c => {
                      const st       = statusMap.get(c.customer_id)
                      const expanded = expandedClients.has(c.customer_id)
                      const hasMult  = c.projetos.length > 1
                      return (
                        <>
                          {/* Linha do cliente */}
                          <tr
                            key={c.customer_id}
                            style={{ cursor: hasMult ? 'pointer' : 'default' }}
                            className="border-b transition-colors hover:bg-white/5"
                            onClick={hasMult ? () => toggleClient(c.customer_id) : undefined}
                          >
                            <td className="px-5 py-3 text-sm font-medium" style={{ color: 'var(--brand-text)' }}>
                              <div className="flex items-center gap-2">
                                {hasMult
                                  ? (expanded ? <ChevronDown size={14} style={{ color: 'var(--brand-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--brand-muted)' }} />)
                                  : <ChevronRight size={14} style={{ color: 'var(--brand-muted)' }} />
                                }
                                <span>{c.nome}</span>
                                {!hasMult && c.projetos[0] && (
                                  <span className="text-xs font-normal" style={{ color: 'var(--brand-muted)' }}>
                                    — {c.projetos[0].nome}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              {st === 'closed'
                                ? <Badge variant="success"><Lock size={10} className="mr-1" />Fechado</Badge>
                                : <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>Aberto</span>
                              }
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums text-sm" style={{ color: 'var(--brand-text)' }}>
                              {c.total_horas.toFixed(2)}h
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums text-sm" style={{ color: 'var(--brand-muted)' }}>
                              {!hasMult && c.projetos[0] ? formatBRL(c.projetos[0].valor_hora) : '—'}
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: 'var(--brand-primary)' }}>
                              {formatBRL(c.total_receita)}
                            </td>
                          </tr>
                          {/* Linhas dos projetos (expandido ou multi-projeto) */}
                          {expanded && hasMult && c.projetos.map(p => (
                            <tr
                              key={`${c.customer_id}-${p.projeto_id}`}
                              className="border-b"
                            >
                              <td className="py-2.5 text-xs" style={{ color: 'var(--brand-muted)', paddingLeft: '2.75rem' }}>
                                {p.nome}
                                <span className="ml-2 opacity-60">{p.codigo}</span>
                                <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(0,245,255,0.08)', color: 'var(--brand-primary)' }}>
                                  {p.tipo_nome}
                                </span>
                              </td>
                              <td />
                              <td className="px-5 py-2.5 text-right tabular-nums text-xs" style={{ color: 'var(--brand-muted)' }}>
                                {p.horas.toFixed(2)}h
                              </td>
                              <td className="px-5 py-2.5 text-right tabular-nums text-xs" style={{ color: 'var(--brand-muted)' }}>
                                {formatBRL(p.valor_hora)}
                              </td>
                              <td className="px-5 py-2.5 text-right tabular-nums text-xs font-medium" style={{ color: 'var(--brand-primary)' }}>
                                {formatBRL(p.total_display)}
                              </td>
                            </tr>
                          ))}
                        </>
                      )
                    })}
                  </Tbody>
                </Table>

                {/* Rodapé */}
                <div className="flex justify-end pt-4">
                  <div className="px-5 py-3 rounded-xl"
                    style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
                    <span className="text-sm font-semibold mr-4" style={{ color: 'var(--brand-muted)' }}>
                      {totalHoras.toFixed(2)}h · Total Geral
                    </span>
                    <span className="text-base font-bold tabular-nums" style={{ color: 'var(--brand-primary)' }}>
                      {formatBRL(totalReceita)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Quando tab não é global e nenhum cliente foi selecionado */}
          {tab !== 'global' && !customerId && (
            <EmptyState icon={Building2} title="Selecione um cliente"
              description="Escolha o cliente e o período para visualizar o fechamento." />
          )}

          {tab !== 'global' && customerId && (
            <>

              {/* ── Tab Apontamentos ── */}
              {tab === 'servicos' && (
                loading ? <SkeletonTable rows={6} cols={5} /> :
                projetos.length === 0 ? (
                  <EmptyState icon={FileText} title="Sem apontamentos"
                    description="Nenhum apontamento aprovado encontrado no período e filtro selecionados." />
                ) : (
                  <div className="space-y-6">
                    {projetos.map(p => (
                      <div key={p.projeto_id}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm font-semibold" style={{ color: 'var(--brand-text)' }}>
                              {p.projeto_nome}
                            </span>
                            <span className="ml-2 text-xs" style={{ color: 'var(--brand-subtle)' }}>
                              {p.projeto_codigo}
                            </span>
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(0,245,255,0.08)', color: 'var(--brand-primary)' }}>
                              {p.tipo_contrato}
                            </span>
                          </div>
                          <div className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                            {formatBRL(p.valor_hora)}/h
                          </div>
                        </div>
                        <Table>
                          <Thead>
                            <tr>
                              <Th>Data</Th>
                              <Th>Colaborador</Th>
                              <Th>Solicitante</Th>
                              <Th>Ticket</Th>
                              <Th>Título</Th>
                              <Th right>Horas</Th>
                            </tr>
                          </Thead>
                          <Tbody>
                            {(p.apontamentos ?? []).map(ts => (
                              <Tr key={ts.id}>
                                <Td muted className="text-xs tabular-nums whitespace-nowrap">{fmtDate(ts.data)}</Td>
                                <Td className="text-xs">{ts.colaborador}</Td>
                                <Td muted className="text-xs">{ts.solicitante ?? '—'}</Td>
                                <Td muted className="text-xs">{ts.ticket ? <a href={`https://erpserv.movidesk.com/Ticket/Edit/${ts.ticket}`} target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400">#{ts.ticket}</a> : '—'}</Td>
                                <Td muted className="text-xs">{ts.titulo ?? '—'}</Td>
                                <Td right className="tabular-nums text-xs font-medium">
                                  {ts.horas.toFixed(2)}h
                                  {ts.client_extra_pct ? (
                                    <span className="ml-1.5 text-[10px] font-semibold" style={{ color: '#F59E0B' }}>
                                      +{ts.client_extra_pct}%{ts.valor_extra ? ` = +${formatBRL(ts.valor_extra)}` : ''}
                                    </span>
                                  ) : null}
                                </Td>
                              </Tr>
                            ))}
                            {p.extra_receita != null && p.extra_receita > 0 && (
                              <Tr>
                                <td colSpan={6} className="px-5 py-2 text-right text-[10px] font-semibold"
                                  style={{ color: '#d97706' }}>
                                  Acréscimo %
                                </td>
                                <Td right className="text-[10px] font-bold tabular-nums" style={{ color: '#d97706' }}>
                                  +{formatBRL(p.extra_receita)}
                                </Td>
                              </Tr>
                            )}
                            <Tr>
                              <td colSpan={6} className="px-5 py-3 text-right text-xs font-semibold"
                                style={{ color: 'var(--brand-muted)' }}>
                                {p.horas.toFixed(2)}h × {formatBRL(p.valor_hora)}/h{p.extra_receita && p.extra_receita > 0 ? ' + acréscimo' : ''} =
                              </td>
                              <Td right className="font-bold tabular-nums" style={{ color: 'var(--brand-primary)' }}>
                                {formatBRL(p.total_receita)}
                              </Td>
                            </Tr>
                          </Tbody>
                        </Table>
                      </div>
                    ))}
                    <div className="flex justify-end pt-2">
                      <div className="px-5 py-3 rounded-xl"
                        style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
                        <span className="text-sm font-semibold mr-4" style={{ color: 'var(--brand-muted)' }}>
                          {totalHoras.toFixed(2)}h · Total Serviços
                        </span>
                        <span className="text-base font-bold tabular-nums" style={{ color: 'var(--brand-primary)' }}>
                          {formatBRL(totalGeral)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* ── Tab Relatório Serviços ── */}
              {tab === 'relatorio' && (
                projetos.length === 0 ? (
                  <EmptyState icon={FileText} title="Sem dados para relatório"
                    description="Nenhum apontamento encontrado no período selecionado." />
                ) : (loading || reportHtmlLoading || reportHtml === null) ? (
                  <SkeletonTable rows={6} cols={4} />
                ) : (
                    /* Split horizontal — preview à esquerda, painel de ações à direita */
                    <div className="flex-1 flex min-h-0 flex-col md:flex-row -m-6">
                      {/* LEFT — preview do documento, largura limitada e centralizada */}
                      <div className="flex-1 min-h-0 overflow-auto flex justify-center p-3 md:p-6" style={{ background: 'var(--bg)' }}>
                        <iframe
                          ref={reportIframeRef}
                          srcDoc={reportHtml}
                          title="Relatório"
                          className="w-full"
                          style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, maxWidth: 820, minHeight: 640 }}
                        />
                      </div>

                      {/* RIGHT — painel de ações fixo */}
                      <aside
                        className="shrink-0 w-full md:w-[300px] flex flex-col gap-3 p-4 overflow-y-auto border-t md:border-t-0 md:border-l"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                      >
                        <div className="pb-3 mb-1" style={{ borderBottom: '1px solid var(--border)' }}>
                          <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>{clienteNome}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {fromYM === toYM ? fmtYM(toYM) : `${fmtYM(fromYM)} — ${fmtYM(toYM)}`}
                          </p>
                          <p className="text-[11px] mt-2 uppercase tracking-wide" style={{ color: 'var(--text-light)' }}>Valor a pagar</p>
                          <p className="text-lg font-bold" style={{ color: 'var(--primary)' }}>{formatBRL(totalGeral)}</p>
                        </div>

                        <Button
                          variant="primary"
                          size="sm"
                          icon={Printer}
                          className="w-full !justify-start"
                          onClick={() => reportIframeRef.current?.contentWindow?.print()}
                        >
                          Imprimir
                        </Button>

                        {canSendEmail && (
                          <Button
                            size="sm"
                            icon={Mail}
                            className="w-full !justify-start"
                            title={`Enviar fechamento de ${clienteNome} por e-mail`}
                            onClick={openCompose}
                          >
                            Enviar e-mail
                          </Button>
                        )}

                        {/* Status de envio: legenda (data/hora/quem) + limpar */}
                        {canSendEmail && (
                          status?.envio_em ? (
                            <div
                              className="rounded-lg px-3 py-2 text-xs flex items-start justify-between gap-2"
                              style={{ background: 'var(--success-bg)', color: 'var(--success)' }}
                            >
                              <span className="flex items-start gap-1.5">
                                <Check size={13} className="mt-0.5 shrink-0" />
                                <span>Enviado em {fmtDateTime(status.envio_em)}{status.envio_por ? ` por ${status.envio_por}` : ''}</span>
                              </span>
                              <button
                                onClick={limparEnvio}
                                disabled={limpandoEnvio}
                                className="shrink-0 disabled:opacity-50 hover:underline"
                                style={{ color: 'var(--text-light)' }}
                              >
                                {limpandoEnvio ? '...' : 'limpar'}
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs px-1" style={{ color: 'var(--text-light)' }}>Fechamento ainda não enviado.</p>
                          )
                        )}

                        <Button
                          size="sm"
                          icon={FileSpreadsheet}
                          loading={downloadingExcel}
                          className="w-full !justify-start"
                          onClick={downloadExcel}
                        >
                          {downloadingExcel ? 'Baixando…' : 'Baixar Excel'}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          icon={X}
                          className="w-full !justify-start mt-auto"
                          onClick={() => setTab('servicos')}
                        >
                          Fechar
                        </Button>
                      </aside>
                    </div>
                )
              )}

              {/* ── Tab Despesas ── */}
              {tab === 'despesas' && (
                loadingDespesas ? <SkeletonTable rows={5} cols={5} /> :
                despesas.length === 0 ? (
                  <EmptyState icon={Receipt} title="Sem despesas"
                    description="Nenhuma despesa aprovada encontrada no período selecionado." />
                ) : (
                  <>
                    <div className="flex justify-end mb-4">
                      <Button size="sm" onClick={() => handlePrint('despesas')}
                        style={{ background: 'var(--brand-primary)', color: '#000' }}>
                        <Printer size={13} />
                        <span className="ml-1.5">Relatório de Despesas</span>
                      </Button>
                    </div>

                    {/* Tabela de despesas (UI) */}
                    <div className="mb-6">
                      <Table>
                        <Thead>
                          <tr>
                            <Th>Data</Th>
                            <Th>Descrição</Th>
                            <Th>Categoria</Th>
                            <Th>Colaborador</Th>
                            <Th>Projeto</Th>
                            <Th right>Valor</Th>
                          </tr>
                        </Thead>
                        <Tbody>
                          {despesas.map(d => (
                            <Tr key={d.id}>
                              <Td muted className="text-xs tabular-nums whitespace-nowrap">{fmtDate(d.data)}</Td>
                              <Td className="text-xs">{d.descricao}</Td>
                              <Td muted className="text-xs">{d.categoria}</Td>
                              <Td muted className="text-xs">{d.colaborador}</Td>
                              <Td muted className="text-xs">{d.projeto}</Td>
                              <Td right className="tabular-nums text-xs font-medium">{formatBRL(d.valor)}</Td>
                            </Tr>
                          ))}
                          <Tr>
                            <td colSpan={5} className="px-5 py-3 text-right text-xs font-bold"
                              style={{ color: 'var(--brand-muted)' }}>
                              TOTAL DESPESAS
                            </td>
                            <Td right className="tabular-nums font-bold" style={{ color: 'var(--brand-primary)' }}>
                              {formatBRL(totalDespesas)}
                            </Td>
                          </Tr>
                        </Tbody>
                      </Table>
                    </div>

                    {/* Documento para impressão */}
                    <div id="print-despesas">
                      <div className="bg-white text-gray-900 rounded-2xl shadow-lg mx-auto"
                        style={{ maxWidth: 800, fontFamily: 'Arial, sans-serif' }}>
                        <div className="flex items-start justify-between px-10 pt-8 pb-6"
                          style={{ borderBottom: '2px solid #5b21b6' }}>
                          <Image src="/logo.png" alt="ERPSERV" width={180} height={72}
                            style={{ objectFit: 'contain' }} />
                          <div className="text-right">
                            <div className="text-xl font-bold text-gray-800 mb-1">Relatório de Despesas</div>
                            <div className="text-sm text-gray-500">Reembolso ao Cliente</div>
                            <div className="mt-2 text-sm text-gray-700">
                              <span className="font-semibold">Cliente:</span> {clienteNome}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Competência:</span>{' '}
                              {fromYM === toYM ? fmtYMFull(toYM) : `${fmtYM(fromYM)} a ${fmtYM(toYM)}`}
                            </div>
                          </div>
                        </div>
                        <div className="px-10 py-6">
                          <table className="w-full text-sm border-collapse">
                            <thead className="sticky top-0 z-10" style={{ background: '#f5f3ff' }}>
                              <tr style={{ background: '#f5f3ff' }}>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Data</th>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Descrição</th>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Categoria</th>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Colaborador</th>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Projeto</th>
                                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {despesas.map((d, i) => (
                                <tr key={d.id}
                                  style={{ background: i % 2 === 0 ? '#fff' : '#faf9ff', borderBottom: '1px solid #e5e7eb' }}>
                                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{fmtDate(d.data)}</td>
                                  <td className="px-3 py-2 text-xs text-gray-800">{d.descricao}</td>
                                  <td className="px-3 py-2 text-xs text-gray-500">{d.categoria}</td>
                                  <td className="px-3 py-2 text-xs text-gray-500">{d.colaborador}</td>
                                  <td className="px-3 py-2 text-xs text-gray-500">{d.projeto}</td>
                                  <td className="px-3 py-2 text-xs text-right font-medium text-gray-800 tabular-nums">
                                    {formatBRL(d.valor)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: '#ede9fe', borderTop: '2px solid #5b21b6' }}>
                                <td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold text-gray-700">
                                  TOTAL DESPESAS
                                </td>
                                <td className="px-3 py-2 text-right text-sm font-bold tabular-nums"
                                  style={{ color: '#5b21b6' }}>
                                  {formatBRL(totalDespesas)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        <div className="px-10 pb-8 flex justify-between items-center text-xs text-gray-400"
                          style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                          <span>ERPSERV Consultoria — Documento gerado pelo sistema Minutor</span>
                          <span>Emitido em {new Date().toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )
              )}

            </>
          )}

        </div>
      </div>

      {/* Dialog de composição/preview do e-mail */}
      {composeOpen && customerId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onMouseDown={e => { composePressOnBackdrop.current = e.target === e.currentTarget }}
          onClick={e => { if (e.target === e.currentTarget && composePressOnBackdrop.current) closeCompose() }}
        >
          <div
            className="ds-card flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Enviar fechamento por e-mail</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {clienteNome} · {fromYM === toYM ? fmtYM(toYM) : `${fmtYM(fromYM)} — ${fmtYM(toYM)}`}
                </p>
              </div>
              <button
                onClick={closeCompose}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
              {/* Destinatários */}
              <div className="rounded-lg p-4 flex flex-col gap-4" style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}>
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-light)' }}>
                  Destinatários
                </span>

                {/* E-mails do cliente (cadastrados) — editável + salvar no cadastro */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    E-mails do cliente (cadastrados)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cadastradoInput}
                      onChange={e => { setCadastradoInput(e.target.value); setCadastroSaved(false) }}
                      placeholder="email1@dominio.com, email2@dominio.com"
                      className="flex-1 rounded-lg px-3 py-2 text-sm ds-input focus:outline-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Save}
                      loading={savingCadastro}
                      onClick={saveCadastro}
                      title="Salvar estes e-mails no cadastro do cliente"
                    >
                      Salvar no cadastro
                    </Button>
                  </div>
                  {cadastroSaved && (
                    <p className="text-[11px] mt-1" style={{ color: 'var(--success)' }}>
                      Salvo no cadastro do cliente.
                    </p>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-light)' }}>
                    Separe vários e-mails por vírgula. Estes ficam salvos para os próximos fechamentos.
                  </p>
                </div>

                {/* E-mail avulso (só deste envio) — chips add/remove */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    E-mail avulso (só deste envio)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={avulsoDraft}
                      onChange={e => setAvulsoDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addAvulso() } }}
                      placeholder="adicionar e-mail e pressionar Enter"
                      className="flex-1 rounded-lg px-3 py-2 text-sm ds-input focus:outline-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                    <Button size="sm" variant="secondary" icon={Plus} onClick={addAvulso}>
                      Adicionar
                    </Button>
                  </div>
                  {avulsoEmails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {avulsoEmails.map(em => (
                        <span
                          key={em}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                          style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
                        >
                          {em}
                          <button
                            onClick={() => removeAvulso(em)}
                            className="transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            title="Remover"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-light)' }}>
                    Não fica salvo — vale só para este envio.
                  </p>
                </div>
              </div>

              {/* Preview do e-mail (doc HTML claro — mantém o próprio fundo branco) */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-light)' }}>
                    Prévia do e-mail
                  </span>
                  {previewLoading && (
                    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <RefreshCw size={12} className="animate-spin" /> atualizando…
                    </span>
                  )}
                </div>
                <iframe
                  srcDoc={emailPreviewHtml ?? ''}
                  title="Prévia do e-mail"
                  className="w-full"
                  style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, height: 360 }}
                />
              </div>

              {/* Mensagem editável (por envio — não persiste) */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-light)' }}>
                  Mensagem do e-mail
                </label>
                <textarea
                  value={emailMensagem}
                  onChange={e => setEmailMensagem(e.target.value)}
                  rows={5}
                  placeholder="Mensagem que aparece no corpo do e-mail…"
                  className="w-full rounded-lg px-3 py-2 text-sm resize-y ds-input focus:outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <Button variant="ghost" size="sm" onClick={closeCompose} disabled={sendingEmail}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Send}
                loading={sendingEmail}
                onClick={sendReportEmail}
              >
                {sendingEmail ? 'Enviando…' : 'Enviar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
