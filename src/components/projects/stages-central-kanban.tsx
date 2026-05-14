'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Users, Layers, Clock } from 'lucide-react'
import { computeStageHealth } from '@/lib/utils/stage-health'
import { HealthDots } from './health-dots'
import type { ProjectStage, StageDerivedStatus } from '@/lib/types/project-stage'

interface Props {
  projectId: number
  stages: ProjectStage[]
}

interface Column {
  status: StageDerivedStatus
  label: string
  color: string
}

const COLUMNS: Column[] = [
  { status: 'planejamento', label: 'Planejamento', color: 'var(--text-muted)' },
  { status: 'execucao',     label: 'Em Execução',  color: 'var(--primary)' },
  { status: 'homologacao',  label: 'Homologação',  color: 'var(--warning)' },
  { status: 'bloqueada',    label: 'Bloqueada',    color: 'var(--danger)' },
  { status: 'concluida',    label: 'Concluída',    color: 'var(--success)' },
]

function n(v: unknown): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function formatHours(v: number): string {
  return v >= 10 ? `${Math.round(v)}h` : `${v.toFixed(1)}h`
}

export function StagesCentralKanban({ projectId, stages }: Props) {
  const byColumn = useMemo(() => {
    const map: Record<StageDerivedStatus, ProjectStage[]> = {
      planejamento: [], execucao: [], homologacao: [], bloqueada: [], concluida: [],
    }
    stages.forEach(s => {
      const key = (s.derived_status ?? 'planejamento') as StageDerivedStatus
      if (map[key]) map[key].push(s)
      else map.planejamento.push(s)
    })
    return map
  }, [stages])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(260px, 1fr))`,
      gap: 12,
      overflowX: 'auto',
    }}>
      {COLUMNS.map(col => {
        const items = byColumn[col.status]
        return (
          <div
            key={col.status}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 10,
              minHeight: 200,
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
              <span style={{
                fontSize: 11, color: col.color, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '.04em',
              }}>
                {col.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: .6 }}>{items.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {items.map(stage => (
                <StageMacroCard key={stage.id} stage={stage} projectId={projectId} />
              ))}
              {items.length === 0 && (
                <div style={{
                  fontSize: 11, color: 'var(--text-light)',
                  textAlign: 'center', padding: '12px 8px',
                  fontStyle: 'italic',
                }}>
                  vazio
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StageMacroCard({ stage, projectId }: { stage: ProjectStage; projectId: number }) {
  const health = computeStageHealth({ stage })
  const planned = n(stage.hours_planned)
  const totalDeliv = stage.deliveries_count ?? 0
  const doneDeliv = stage.deliveries_done_count ?? 0
  const pct = totalDeliv > 0 ? Math.round((doneDeliv / totalDeliv) * 100) : 0
  const teamCount = stage.team_overrun_count !== undefined ? 'alocados' : null
  void teamCount

  return (
    <Link
      href={`/projetos/${projectId}/etapas/${stage.id}`}
      className="ds-card"
      style={{
        display: 'block',
        padding: 12,
        textDecoration: 'none',
        color: 'inherit',
        background: 'var(--bg)',
        cursor: 'pointer',
        transition: 'transform .12s ease, box-shadow .12s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {stage.name}
          </div>
          {stage.responsible?.name && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {stage.responsible.name}
            </div>
          )}
        </div>
        <HealthDots health={health} />
      </div>

      {totalDeliv > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            height: 4, width: '100%',
            background: 'var(--surface-hover)', borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, pct)}%`,
              background: 'var(--primary)',
              transition: 'width .2s ease',
            }} />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, color: 'var(--text-muted)', marginTop: 4,
          }}>
            <span>{doneDeliv}/{totalDeliv} entregas</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 10, fontSize: 11, color: 'var(--text-muted)',
        gap: 8,
      }}>
        {planned > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} /> {formatHours(planned)}
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Layers size={10} /> {totalDeliv}
        </span>
        {(stage.team_overrun_count ?? 0) > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            color: 'var(--danger)',
          }}>
            <Users size={10} /> {stage.team_overrun_count}
          </span>
        )}
      </div>
    </Link>
  )
}
