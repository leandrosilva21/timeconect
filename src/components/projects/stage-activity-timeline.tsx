'use client'

import { useStageActivity } from '@/hooks/use-stage-activity'
import type { StageActivityEvent, StageActivityType } from '@/lib/types/stage-activity'

const TYPE_LABEL: Record<StageActivityType, string> = {
  delivery_moved:     'moveu',
  delivery_created:   'criou',
  delivery_completed: 'concluiu',
  hours_logged:       'apontou horas',
  aporte_created:     'aportou',
  block_set:          'bloqueou a etapa',
  block_cleared:      'desbloqueou a etapa',
  comment:            'comentou',
}

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'Em Execução',
  waiting_client: 'Aguardando Cliente',
  review: 'Homologação',
  done: 'Concluído',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  return new Date(iso).toLocaleDateString('pt-BR')
}

function describe(ev: StageActivityEvent): string {
  const p = ev.payload || {}
  switch (ev.type) {
    case 'delivery_moved': {
      const title = String(p.title ?? '')
      const from = STATUS_LABEL[p.from as string] ?? String(p.from ?? '—')
      const to = STATUS_LABEL[p.to as string] ?? String(p.to ?? '—')
      return `moveu "${title}" de ${from} para ${to}`
    }
    case 'delivery_created':
      return `criou entrega "${p.title ?? ''}"`
    case 'delivery_completed':
      return `concluiu "${p.title ?? ''}"`
    case 'aporte_created': {
      const hours = Number(p.hours ?? 0)
      const sign = hours >= 0 ? '+' : ''
      return `aporte ${sign}${hours}h — ${p.reason ?? ''}`
    }
    case 'block_set':
      return `bloqueou a etapa: ${p.reason ?? ''}`
    case 'block_cleared':
      return 'desbloqueou a etapa'
    case 'hours_logged':
      return `apontou ${p.hours ?? '?'}h`
    case 'comment':
      return `comentou: ${p.text ?? ''}`
    default:
      return TYPE_LABEL[ev.type] ?? ev.type
  }
}

interface Props {
  stageId: number
  limit?: number
}

export function StageActivityTimeline({ stageId, limit = 50 }: Props) {
  const { items, loading, error } = useStageActivity(stageId, limit)

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Carregando atividade…</div>
  if (error) return <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>
  if (items.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        Sem atividade registrada ainda.
      </div>
    )
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((ev, i) => (
        <li
          key={ev.id}
          style={{
            display: 'flex', gap: 10,
            padding: '8px 0',
            borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--border)',
          }}
        >
          <div style={{ flexShrink: 0, paddingTop: 5 }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6,
              borderRadius: '50%', background: 'var(--primary)',
            }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>
              <strong style={{ fontWeight: 500 }}>{ev.actor?.name ?? 'Sistema'}</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>{describe(ev)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
              {timeAgo(ev.created_at)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
