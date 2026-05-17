'use client'

import { StagesCentralKanban } from '@/components/projects/stages-central-kanban'
import type { ScheduleStage } from '@/hooks/use-project-schedule'

interface Props {
  projectId: number
  stages: ScheduleStage[]
}

export function BoardView({ projectId, stages }: Props) {
  if (stages.length === 0) {
    return (
      <div style={{
        padding: '48px 24px', textAlign: 'center',
        color: 'var(--text-muted)',
        border: '1px dashed var(--border)', borderRadius: 8,
      }}>
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>Nenhuma etapa ainda</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>
          Crie a primeira frente do projeto (ex: Fiscal, Compras, Integrações).
        </div>
      </div>
    )
  }
  return <StagesCentralKanban projectId={projectId} stages={stages} />
}
