'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import {
  Building2, Briefcase, Clock, Headphones, TrendingUp, ChevronDown,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

type Health = 'ok' | 'warning' | 'critical' | 'unknown'

interface ProjectHealth {
  id: number
  code: string
  name: string
  contract_type: string | null
  sold_hours: number
  consumed_hours: number | null
  balance_hours: number | null
  percentage: number | null
  status: Health
}

interface MonthlyPoint {
  month: string
  label: string
  tickets: number
  sold_hours: number
}

interface Summary {
  customer:                      { id: number; name: string }
  open_tickets:                  number
  open_tickets_current_month:    number
  current_month_label:           string
  total_projects:                number
  total_sold_hours:              number
  projects_health:               ProjectHealth[]
  monthly_series:                MonthlyPoint[]
}

interface CustomerOpt { id: number; name: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtH(h: number | null | undefined) {
  if (h === null || h === undefined) return '—'
  return h.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'h'
}

const HEALTH_META: Record<Health, { label: string; color: string; bg: string }> = {
  ok:       { label: 'Saudável', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  warning:  { label: 'Atenção',  color: '#F59E0B', bg: 'rgba(245,158,11,0.14)' },
  critical: { label: 'Crítico',  color: '#EF4444', bg: 'rgba(239,68,68,0.14)' },
  unknown:  { label: '—',        color: '#A1A1AA', bg: 'rgba(161,161,170,0.10)' },
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  accent: 'primary' | 'purple' | 'amber'
}) {
  const color = accent === 'primary' ? '#00F5FF' : accent === 'purple' ? '#A78BFA' : '#F59E0B'
  const bg    = accent === 'primary' ? 'rgba(0,245,255,0.10)' : accent === 'purple' ? 'rgba(167,139,250,0.10)' : 'rgba(245,158,11,0.10)'
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
        <Icon size={18} color={color} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--brand-subtle)' }}>{label}</p>
        <p className="text-2xl font-extrabold tracking-tight leading-none" style={{ color }}>{value}</p>
      </div>
    </div>
  )
}

function MonthlyEvolution({ series }: { series: MonthlyPoint[] }) {
  const maxTickets = Math.max(1, ...series.map(p => p.tickets))
  const maxHours   = Math.max(1, ...series.map(p => p.sold_hours))
  const hasAny     = series.some(p => p.tickets > 0 || p.sold_hours > 0)

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--brand-muted)' }}>Evolução · 12 Meses</h2>
        <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--brand-subtle)' }}>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: '#F59E0B' }} />Tickets abertos</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: '#A78BFA' }} />Horas vendidas</span>
        </div>
      </div>
      {!hasAny ? (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--brand-subtle)' }}>Sem movimentação nos últimos 12 meses.</p>
      ) : (
        <div className="flex items-end gap-2 h-44">
          {series.map(p => {
            const tPct = (p.tickets / maxTickets) * 100
            const hPct = (p.sold_hours / maxHours) * 100
            return (
              <div key={p.month} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                <div className="w-full flex items-end justify-center gap-0.5" style={{ height: 'calc(100% - 22px)' }}>
                  <div className="w-1/2 rounded-t" title={`${p.tickets} tickets`}
                    style={{ height: `${Math.max(2, tPct)}%`, background: 'rgba(245,158,11,0.85)' }} />
                  <div className="w-1/2 rounded-t" title={`${p.sold_hours.toFixed(1)}h vendidas`}
                    style={{ height: `${Math.max(2, hPct)}%`, background: 'rgba(167,139,250,0.85)' }} />
                </div>
                <span className="text-[9px] truncate w-full text-center" style={{ color: 'var(--brand-subtle)' }}>{p.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HealthBar({ pct }: { pct: number | null }) {
  const p = pct ?? 0
  const color = pct === null ? '#71717A' : pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981'
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, p)}%`, background: color }} />
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PortalClientePage() {
  const { user } = useAuth()
  const router = useRouter()

  const [summary, setSummary]     = useState<Summary | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerOpt[]>([])
  const [customerId, setCustomerId] = useState<number | ''>('')

  const isCliente = user?.type === 'cliente'
  const isAdmin   = user?.type === 'admin'
  const isCoord   = user?.type === 'coordenador'
  const canPickCustomer = isAdmin || isCoord

  useEffect(() => {
    if (!user) return
    if (user.type === 'consultor' || (user.type === 'parceiro_admin' && !(user as any).is_executive)) {
      router.replace('/dashboard')
    }
  }, [user, router])

  // Carregar lista de clientes (admin/coord)
  useEffect(() => {
    if (!canPickCustomer) return
    api.get<CustomerOpt[]>('/client/portal/customers')
      .then(rows => {
        setCustomers(rows)
        if (rows.length && customerId === '') setCustomerId(rows[0].id)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPickCustomer])

  // Carregar resumo
  useEffect(() => {
    if (!user) return
    const cid = isCliente ? user.customer_id : (customerId || null)
    if (!cid) { setSummary(null); setLoading(false); return }
    setLoading(true)
    setError(null)
    api.get<Summary>(`/client/portal/summary?customer_id=${cid}`)
      .then(d => setSummary(d))
      .catch((e: any) => setError(e?.message ?? 'Erro ao carregar resumo'))
      .finally(() => setLoading(false))
  }, [user, isCliente, customerId])

  const projetos = summary?.projects_health ?? []
  const projetosOrdenados = useMemo(() => {
    const order: Record<Health, number> = { critical: 0, warning: 1, ok: 2, unknown: 3 }
    return [...projetos].sort((a, b) => {
      const d = order[a.status] - order[b.status]
      if (d !== 0) return d
      return (b.percentage ?? -1) - (a.percentage ?? -1)
    })
  }, [projetos])

  return (
    <AppLayout title="Portal Cliente">
      <div className="space-y-6 max-w-6xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,245,255,0.10)' }}>
              <Building2 size={18} color="#00F5FF" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--brand-text)' }}>
                {summary?.customer.name ?? 'Portal Cliente'}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                Resumo executivo do cliente
              </p>
            </div>
          </div>

          {canPickCustomer && customers.length > 0 && (
            <div className="relative">
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                className="appearance-none pr-9 pl-3 h-10 rounded-xl text-sm outline-none cursor-pointer"
                style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', color: 'var(--brand-text)' }}
              >
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--brand-subtle)' }} />
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl p-10 text-center text-sm" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', color: 'var(--brand-muted)' }}>
            Carregando…
          </div>
        )}

        {/* Erro */}
        {!loading && error && (
          <div className="rounded-2xl p-6 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
            {error}
          </div>
        )}

        {/* Sem cliente */}
        {!loading && !error && !summary && (
          <div className="rounded-2xl p-10 text-center text-sm" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', color: 'var(--brand-muted)' }}>
            Selecione um cliente para visualizar o resumo.
          </div>
        )}

        {/* Conteúdo */}
        {!loading && !error && summary && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                icon={Headphones}
                label={`Tickets Abertos em ${summary.current_month_label}`}
                value={String(summary.open_tickets_current_month)}
                accent="amber"
              />
              <KpiCard   icon={Briefcase}  label="Projetos"          value={String(summary.total_projects)} accent="primary" />
              <KpiCard   icon={Clock}      label="Horas Contratadas" value={fmtH(summary.total_sold_hours)} accent="purple" />
            </div>

            {/* Evolução 12 meses */}
            <MonthlyEvolution series={summary.monthly_series} />


            {/* Saúde dos projetos (não-Fechados) */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
              <div className="px-5 py-3.5 flex items-center gap-2 border-b" style={{ borderColor: 'var(--brand-border)' }}>
                <TrendingUp size={14} style={{ color: 'var(--brand-primary)' }} />
                <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--brand-muted)' }}>Saúde dos Projetos</h2>
                <span className="text-[10px] ml-auto" style={{ color: 'var(--brand-subtle)' }}>
                  Não considera projetos do tipo Fechado
                </span>
              </div>

              {projetosOrdenados.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--brand-subtle)' }}>
                  Nenhum projeto com saldo ativo no momento.
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
                  {projetosOrdenados.map(p => {
                    const meta = HEALTH_META[p.status]
                    return (
                      <li key={p.id} className="px-5 py-4 flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--brand-subtle)' }}>{p.code}</span>
                            <span className="text-sm font-medium" style={{ color: 'var(--brand-text)' }}>{p.name}</span>
                            {p.contract_type && (
                              <span className="text-[10px]" style={{ color: 'var(--brand-subtle)' }}>· {p.contract_type}</span>
                            )}
                          </div>
                          <HealthBar pct={p.percentage} />
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--brand-subtle)' }}>
                            {fmtH(p.consumed_hours)} / {fmtH(p.sold_hours)}
                          </p>
                          <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                            style={{ background: meta.bg, color: meta.color }}>
                            {meta.label}{p.percentage !== null && ` · ${p.percentage.toFixed(0)}%`}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
