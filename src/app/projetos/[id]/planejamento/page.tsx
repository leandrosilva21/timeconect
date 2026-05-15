'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Info } from 'lucide-react'
import { useProjectSchedule } from '@/hooks/use-project-schedule'
import { useAuth } from '@/hooks/use-auth'
import { ProjectScheduleTable } from '@/components/projects/project-schedule-table'
import { ProjectScheduleGantt } from '@/components/projects/project-schedule-gantt'
import { ProjectScheduleCapacity } from '@/components/projects/project-schedule-capacity'

/**
 * Cronograma operacional do projeto (ADR 0009).
 *
 * Cronograma e Board são duas views da mesma entidade (project_stages +
 * stage_deliveries). Edição aqui reflete imediatamente em /etapas e
 * vice-versa.
 */
export default function PlanejamentoPage() {
  const params = useParams<{ id: string }>()
  const projectId = Number(params.id)
  const { user } = useAuth()
  const canEdit = user?.type !== 'consultor' && user?.type !== 'cliente'
  const [highlightUserId, setHighlightUserId] = useState<number | null>(null)

  const { isOperational, project, stages, projectWindow, loading, error, refetch } = useProjectSchedule(projectId)

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Carregando cronograma…</div>
  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>

  if (!isOperational) {
    return (
      <div style={{
        padding: '32px 24px', textAlign: 'center',
        border: '1px dashed var(--border)', borderRadius: 8,
      }}>
        <Info size={20} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
          Projeto de sustentação
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 480, margin: '6px auto 0' }}>
          Cronograma é só pra projetos operacionais. Sustentação opera por demanda contínua, sem fases planejadas.
        </div>
      </div>
    )
  }

  const totalActivities = stages.reduce((s, st) => s + (st.deliveries?.length ?? 0), 0)
  const totalActivityHours = stages.reduce((s, st) =>
    s + (st.deliveries?.reduce((sub, d) => sub + (Number(d.hours_planned) || 0), 0) ?? 0)
  , 0)

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 16,
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}>
        <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span><strong style={{ color: 'var(--text)' }}>Cronograma</strong></span>
          <span>
            {stages.length} {stages.length === 1 ? 'etapa' : 'etapas'}
            {' · '}
            {totalActivities} {totalActivities === 1 ? 'atividade' : 'atividades'}
            {' · '}
            <strong style={{ color: 'var(--text)' }}>{Math.round(totalActivityHours)}h</strong> planejadas
          </span>
          {projectWindow?.start && projectWindow?.end && (
            <span>
              Janela: <strong style={{ color: 'var(--text)' }}>
                {new Date(projectWindow.start).toLocaleDateString('pt-BR')}
              </strong>
              {' → '}
              <strong style={{ color: 'var(--text)' }}>
                {new Date(projectWindow.end).toLocaleDateString('pt-BR')}
              </strong>
            </span>
          )}
        </div>
        {project && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Saldo do projeto: <strong style={{ color: 'var(--text)' }}>{project.sold_hours}h</strong>
          </div>
        )}
      </div>

      <div style={{
        marginBottom: 12,
        padding: '8px 12px',
        background: 'var(--primary-soft)',
        borderRadius: 6,
        fontSize: 11, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Info size={11} />
        <span>
          Edição aqui reflete imediatamente no <strong>Board de Etapas</strong>. Cronograma e operação são a mesma fonte de verdade (ADR 0009).
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProjectScheduleTable
          projectId={projectId}
          stages={stages}
          canEdit={canEdit}
          onChanged={refetch}
        />

        <ProjectScheduleGantt
          stages={stages}
          projectWindow={projectWindow}
          canEdit={canEdit}
          onChanged={refetch}
          highlightUserId={highlightUserId}
        />

        <ProjectScheduleCapacity
          stages={stages}
          selectedUserId={highlightUserId}
          onSelectUser={setHighlightUserId}
        />
      </div>
    </div>
  )
}
