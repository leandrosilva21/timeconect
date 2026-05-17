'use client'

import { AlertTriangle, Activity, Users, Calendar, TrendingUp, Lock, Clock } from 'lucide-react'
import type { ExecutiveSummary, TeamLoadItem, CronogramaAlert } from '@/hooks/use-project-schedule'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface Props {
  executive: ExecutiveSummary
  teamLoad: TeamLoadItem[]
  alerts: CronogramaAlert[]
  estimatedEnd?: string | null
}

const RISK_BG = { low: 'var(--success-bg)', medium: 'var(--warning-bg)', high: 'var(--danger-bg)' } as const
const RISK_FG = { low: 'var(--success)', medium: 'var(--warning)', high: 'var(--danger)' } as const
const RISK_BORDER = { low: 'var(--success-border)', medium: 'var(--warning-border)', high: 'var(--danger-border)' } as const
const RISK_LABEL = { low: 'Baixo', medium: 'Atenção', high: 'Alto' } as const
const RISK_ICON = { low: '🟢', medium: '🟡', high: '🔴' } as const

function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}

/**
 * Header executivo do Cronograma (Fase 10).
 * Mostra: progresso, risco, atraso, ocupação da equipe, alertas críticos.
 * Estrutura compacta — coordenador lê em <5s o estado do projeto.
 */
export function CronogramaExecutiveHeader({ executive, teamLoad, alerts, estimatedEnd }: Props) {
  const e = executive
  const dangerAlerts = alerts.filter(a => a.severity === 'danger').length
  const warnAlerts = alerts.filter(a => a.severity === 'warning').length

  return (
    <div className="ds-card" style={{ padding: 14, marginBottom: 14, border: `1px solid var(--border)` }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        alignItems: 'stretch',
      }}>
        {/* Progresso */}
        <Card icon={<TrendingUp size={14} />} label="Progresso">
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {e.progress_pct.toFixed(0)}%
          </div>
          <ProgressBar pct={e.progress_pct} />
          <div className="ds-text-body-sm" style={{ color: 'var(--text-muted)' }}>
            {e.done_deliveries}/{e.total_deliveries} atividades
          </div>
        </Card>

        {/* Risco */}
        <Card icon={<AlertTriangle size={14} />} label="Risco geral">
          <div style={{
            fontSize: 18, fontWeight: 700,
            color: RISK_FG[e.overall_risk],
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {RISK_ICON[e.overall_risk]} {RISK_LABEL[e.overall_risk]}
          </div>
          <div className="ds-text-body-sm" style={{ color: 'var(--text-muted)' }}>
            {e.high_risk_stages > 0 && `${e.high_risk_stages} alta`}
            {e.high_risk_stages > 0 && e.medium_risk_stages > 0 && ' · '}
            {e.medium_risk_stages > 0 && `${e.medium_risk_stages} atenção`}
            {e.high_risk_stages === 0 && e.medium_risk_stages === 0 && 'Sem etapas em risco'}
          </div>
        </Card>

        {/* Horas */}
        <Card icon={<Clock size={14} />} label="Horas">
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(e.hours_actual)}h / {Math.round(e.hours_planned)}h
          </div>
          <div className="ds-text-body-sm" style={{ color: e.hours_balance < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            saldo {e.hours_balance >= 0 ? '+' : ''}{Math.round(e.hours_balance)}h
          </div>
        </Card>

        {/* Bloqueios + atrasos */}
        <Card icon={<Lock size={14} />} label="Operacional">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            {e.blocked_count > 0 && <Pill color="danger" value={e.blocked_count} label="bloq." />}
            {e.overdue_count > 0 && <Pill color="danger" value={e.overdue_count} label="atraso" />}
            {e.in_progress_count > 0 && <Pill color="primary" value={e.in_progress_count} label="exec" />}
            {e.waiting_client_count > 0 && <Pill color="warning" value={e.waiting_client_count} label="cliente" />}
            {e.blocked_count === 0 && e.overdue_count === 0 && e.in_progress_count === 0 && e.waiting_client_count === 0 && (
              <span style={{ color: 'var(--text-light)', fontSize: 12 }}>—</span>
            )}
          </div>
          {e.estimated_delay_days > 0 && (
            <div className="ds-text-body-sm" style={{ color: 'var(--danger)' }}>
              <Calendar size={11} style={{ display: 'inline', verticalAlign: 'text-top', marginRight: 3 }} />
              {e.estimated_delay_days}d de atraso
            </div>
          )}
        </Card>

        {/* Equipe */}
        <Card icon={<Users size={14} />} label="Equipe">
          {teamLoad.length === 0 ? (
            <span style={{ color: 'var(--text-light)', fontSize: 12 }}>nenhum responsável</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {teamLoad.slice(0, 3).map(t => (
                <div key={t.user.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Avatar size="sm">
                    {t.user.profile_photo_url && <AvatarImage src={t.user.profile_photo_url} alt={t.user.name} />}
                    <AvatarFallback>{initials(t.user.name)}</AvatarFallback>
                  </Avatar>
                  <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {t.user.name.split(' ')[0]}
                  </span>
                  <span style={{
                    fontWeight: 600, fontSize: 11,
                    color: t.overloaded ? 'var(--danger)' : t.usage_pct > 85 ? 'var(--warning)' : 'var(--text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {Math.round(t.usage_pct)}%
                  </span>
                </div>
              ))}
              {teamLoad.length > 3 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  +{teamLoad.length - 3} consultores
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Alertas */}
        <Card icon={<Activity size={14} />} label="Alertas">
          {alerts.length === 0 ? (
            <div style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>✓ tudo OK</div>
          ) : (
            <div style={{ fontSize: 18, fontWeight: 700, color: dangerAlerts > 0 ? 'var(--danger)' : 'var(--warning)' }}>
              {alerts.length}
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>
                {dangerAlerts > 0 && `${dangerAlerts} crít.`}
                {dangerAlerts > 0 && warnAlerts > 0 && ' · '}
                {warnAlerts > 0 && `${warnAlerts} avisos`}
              </span>
            </div>
          )}
          {estimatedEnd && (
            <div className="ds-text-body-sm" style={{ color: 'var(--text-muted)' }}>
              Prazo: {new Date(estimatedEnd).toLocaleDateString('pt-BR')}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Card({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '8px 10px',
      background: 'var(--surface-hover)',
      borderRadius: 6,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '.06em',
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ color: 'var(--text-light)' }}>{icon}</span>
        {label}
      </div>
      {children}
    </div>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ height: 4, width: '100%', background: 'var(--surface-sunken)', borderRadius: 2, overflow: 'hidden', margin: '2px 0' }}>
      <div style={{ height: '100%', width: `${clamped}%`, background: 'var(--primary)' }} />
    </div>
  )
}

function Pill({ color, value, label }: { color: 'primary' | 'warning' | 'danger'; value: number; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 999,
      background: `var(--${color}-bg)`, color: `var(--${color})`,
      fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
      <span style={{ fontWeight: 500, fontSize: 10 }}>{label}</span>
    </span>
  )
}
