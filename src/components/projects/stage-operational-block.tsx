'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { computeStageHealth } from '@/lib/utils/stage-health'
import { HealthDots } from './health-dots'
import { StageTeamAllocation } from './stage-team-allocation'
import { StageKanbanBoard } from './stage-kanban-board'
import { useStageDeliveries } from '@/hooks/use-stage-deliveries'
import type { ProjectStage } from '@/lib/types/project-stage'

interface Props {
  stage: ProjectStage
  projectId: number
  onChanged: () => void
}

function formatHours(n: number): string {
  const v = Number(n) || 0
  return v >= 10 ? `${Math.round(v)}h` : `${v.toFixed(1)}h`
}

export function StageOperationalBlock({ stage, projectId, onChanged }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(stage.name)
  const [savingName, setSavingName] = useState(false)
  const { deliveries, loading, error, refetch } = useStageDeliveries(expanded ? stage.id : null)

  const health = computeStageHealth({ stage })
  const planned = Number(stage.hours_planned) || 0
  const totalDeliveries = stage.deliveries_count ?? 0
  const doneDeliveries = stage.deliveries_done_count ?? 0
  const pctDeliveries = totalDeliveries > 0 ? Math.round((doneDeliveries / totalDeliveries) * 100) : 0

  async function handleSaveName() {
    if (!name.trim()) { setEditingName(false); setName(stage.name); return }
    setSavingName(true)
    try {
      await api.patch(`/stages/${stage.id}`, { name: name.trim() })
      setEditingName(false)
      onChanged()
      toast.success('Etapa renomeada')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro')
      setName(stage.name)
    } finally {
      setSavingName(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir a etapa "${stage.name}"?\n\nEsta ação remove todas as entregas e alocações desta etapa.`)) return
    try {
      await api.delete(`/stages/${stage.id}`)
      onChanged()
      toast.success('Etapa removida')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao remover')
    }
  }

  return (
    <section style={{
      border: '1px solid var(--border)',
      borderRadius: 8,
      background: 'var(--surface)',
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      {/* Header da etapa */}
      <header style={{
        padding: '12px 16px',
        borderBottom: expanded ? '1px solid var(--border)' : 'none',
        background: 'var(--surface)',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'Recolher' : 'Expandir'}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 2, marginTop: 2,
          }}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {editingName ? (
              <input
                autoFocus
                className="ds-input"
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') { setEditingName(false); setName(stage.name) }
                }}
                disabled={savingName}
                style={{ fontSize: 15, fontWeight: 600, padding: '4px 8px', minWidth: 200 }}
              />
            ) : (
              <h3
                onClick={() => setEditingName(true)}
                style={{
                  fontSize: 15, fontWeight: 600, color: 'var(--text)',
                  margin: 0, cursor: 'text',
                }}
              >
                {stage.name}
              </h3>
            )}
            <HealthDots health={health} />
            <button
              type="button"
              onClick={() => setEditingName(true)}
              aria-label="Editar nome"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 2,
              }}
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Excluir"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 2,
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 12,
            marginTop: 4, fontSize: 12, color: 'var(--text-muted)',
          }}>
            {planned > 0 && <span>{formatHours(planned)} planejadas</span>}
            {totalDeliveries > 0 && (
              <span>{doneDeliveries}/{totalDeliveries} entregas · {pctDeliveries}%</span>
            )}
            {stage.responsible?.name && <span>Resp: {stage.responsible.name}</span>}
          </div>

          {totalDeliveries > 0 && (
            <div style={{
              marginTop: 8, height: 3, width: '100%',
              background: 'var(--surface-hover)', borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${Math.min(100, pctDeliveries)}%`,
                background: 'var(--primary)', transition: 'width .2s ease',
              }} />
            </div>
          )}
        </div>
      </header>

      {/* Conteúdo expandido: alocação + kanban */}
      {expanded && (
        <div style={{ padding: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <StageTeamAllocation stageId={stage.id} projectId={projectId} />
          </div>

          <div style={{
            fontSize: 11, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '.04em',
            marginBottom: 8,
          }}>
            Entregas
          </div>

          {error && <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}
          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando entregas…</div>
          ) : (
            <StageKanbanBoard stageId={stage.id} deliveries={deliveries} onChanged={refetch} />
          )}
        </div>
      )}
    </section>
  )
}
