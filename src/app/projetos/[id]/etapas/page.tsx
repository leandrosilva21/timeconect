'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Info } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { StagesCentralKanban } from '@/components/projects/stages-central-kanban'
import { useProjectStages } from '@/hooks/use-project-stages'
import { useApiQuery } from '@/hooks/use-query'
import { useAuth } from '@/hooks/use-auth'
import type { ProjectStage } from '@/lib/types/project-stage'

interface ProjectMini {
  id: number
  is_operational?: boolean
  sold_hours?: number | string | null
}

function n(v: unknown): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function formatHours(v: number): string {
  return v >= 10 ? `${Math.round(v)}h` : `${v.toFixed(1)}h`
}

/**
 * Kanban CENTRAL das etapas. Cards são as etapas, colunas são status macro
 * derivado (planejamento/execucao/homologacao/bloqueada/concluida).
 *
 * Card NÃO se move por DnD — o status macro é auto-derivado das entregas.
 * Quando 100% das entregas avançam, o card avança automaticamente.
 *
 * Click no card → /projetos/[id]/etapas/[stageId] (kanban das entregas).
 */
export default function EtapasPage() {
  const params = useParams<{ id: string }>()
  const projectId = Number(params.id)
  const { stages, loading, error, refetch } = useProjectStages(projectId)
  const { data: project } = useApiQuery<ProjectMini>(
    Number.isFinite(projectId) ? `/projects/${projectId}` : null
  )
  const { user } = useAuth()
  const canEdit = user?.type !== 'consultor'

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [hours, setHours] = useState('')
  const [saving, setSaving] = useState(false)

  const sold = n(project?.sold_hours)
  const allocated = useMemo(
    () => stages.reduce((s, st) => s + n(st.hours_planned), 0),
    [stages]
  )
  const remaining = Math.max(0, sold - allocated)
  const exceededProject = allocated > sold

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const hoursNum = hours ? Number(hours) : 0
    setSaving(true)
    try {
      await api.post<ProjectStage>(`/projects/${projectId}/stages`, {
        name: name.trim(),
        hours_planned: hoursNum,
      })
      setName(''); setHours(''); setCreating(false)
      refetch()
      toast.success('Etapa criada')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao criar etapa')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Carregando…</div>
  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>

  if (project && project.is_operational === false) {
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
          Este projeto usa modelo de sustentação — alocação direta no projeto, sem etapas operacionais.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 20,
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}>
        <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span><strong style={{ color: 'var(--text)' }}>Saldo operacional</strong></span>
          <span>Vendidas: <strong style={{ color: 'var(--text)' }}>{formatHours(sold)}</strong></span>
          <span>
            Alocadas: <strong style={{ color: exceededProject ? 'var(--danger)' : 'var(--text)' }}>
              {formatHours(allocated)}
            </strong>
          </span>
          <span style={{ color: exceededProject ? 'var(--danger)' : 'var(--text-muted)' }}>
            {exceededProject ? 'Estourado' : 'Restantes: '}
            {!exceededProject && <strong style={{ color: 'var(--text)' }}>{formatHours(remaining)}</strong>}
          </span>
        </div>
        {canEdit && !creating && (
          <button
            type="button"
            className="ds-btn-primary"
            onClick={() => setCreating(true)}
            style={{ fontSize: 13, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} /> Nova etapa
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="ds-card ds-card-pad"
          style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <div style={{ flex: '1 1 240px' }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome</label>
            <input
              autoFocus className="ds-input" value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Fiscal, Compras, Integrações…" maxLength={100}
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div style={{ width: 140 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Horas previstas</label>
            <input
              className="ds-input" type="number" min={0} step="0.5"
              value={hours} onChange={e => setHours(e.target.value)}
              placeholder="0" style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <button type="submit" className="ds-btn-primary"
            style={{ fontSize: 13, padding: '8px 14px' }}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Salvando…' : 'Criar'}
          </button>
          <button type="button" className="ds-btn-ghost"
            style={{ fontSize: 13, padding: '8px 14px' }}
            onClick={() => { setCreating(false); setName(''); setHours('') }}
          >
            Cancelar
          </button>
        </form>
      )}

      {stages.length === 0 ? (
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
      ) : (
        <StagesCentralKanban projectId={projectId} stages={stages} />
      )}
    </div>
  )
}
