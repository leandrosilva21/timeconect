'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useApiQuery } from '@/hooks/use-query'
import { useAuth } from '@/hooks/use-auth'
import { useProjectStages } from '@/hooks/use-project-stages'
import { StageOperationalBlock } from '@/components/projects/stage-operational-block'
import type { ProjectStage } from '@/lib/types/project-stage'

/**
 * Tela dedicada da etapa — kanban das entregas + equipe alocada + aportes.
 * Acessada via card no kanban central de etapas (/projetos/[id]/etapas).
 */
export default function StageDetailPage() {
  const params = useParams<{ id: string; stageId: string }>()
  const projectId = Number(params.id)
  const stageId = Number(params.stageId)
  const { user } = useAuth()
  const canEdit = user?.type !== 'consultor'

  // Carrega etapas e isola a desejada (mesma fonte do central, sem nova rota backend)
  const { stages, loading, refetch } = useProjectStages(projectId)
  const stage = stages.find(s => s.id === stageId)

  if (loading) {
    return <div style={{ color: 'var(--text-muted)' }}>Carregando…</div>
  }

  if (!stage) {
    return (
      <div style={{ padding: 24 }}>
        <Link
          href={`/projetos/${projectId}/etapas`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none',
          }}
        >
          <ChevronLeft size={14} /> Voltar ao kanban de etapas
        </Link>
        <div style={{ marginTop: 16, color: 'var(--danger)' }}>Etapa não encontrada.</div>
      </div>
    )
  }

  return (
    <div>
      <Link
        href={`/projetos/${projectId}/etapas`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none',
          marginBottom: 16,
        }}
      >
        <ChevronLeft size={14} /> Voltar ao kanban de etapas
      </Link>

      <StageOperationalBlock
        stage={stage}
        projectId={projectId}
        canEdit={canEdit}
        onChanged={refetch}
      />
    </div>
  )
}
