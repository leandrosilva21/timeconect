'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Info, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { StageOperationalBlock } from '@/components/projects/stage-operational-block'
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

export default function EtapasPage() {
  const params = useParams<{ id: string }>()
  const projectId = Number(params.id)
  const { stages, loading, error, refetch } = useProjectStages(projectId)
  const { data: project } = useApiQuery<ProjectMini>(
    Number.isFinite(projectId) ? `/projects/${projectId}` : null
  )
  const { user } = useAuth()
  const isConsultor = user?.type === 'consultor'
  const canEdit = !isConsultor

  const [creating, setCreating] = useState(false)
  const [bulkAction, setBulkAction] = useState<'expand' | 'collapse' | null>(null)
  const [bulkKey, setBulkKey] = useState(0)

  function bulkToggle(action: 'expand' | 'collapse') {
    setBulkAction(action)
    setBulkKey(k => k + 1)
  }
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

  // Projeto NÃO operacional: mensagem clara, sem etapas
  if (project && project.is_operational === false) {
    return (
      <div style={{
        padding: '32px 24px',
        textAlign: 'center',
        border: '1px dashed var(--border)',
        borderRadius: 8,
      }}>
        <Info size={20} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
          Projeto de sustentação
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 480, margin: '6px auto 0' }}>
          Este projeto usa modelo de sustentação — alocação direta no projeto, sem etapas operacionais.
          A gestão por etapas é exclusiva de projetos de implantação, evolutivos, migração e similares.
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header geral — capacidade do projeto */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 20,
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}>
        <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>
            <strong style={{ color: 'var(--text)' }}>Saldo operacional</strong>
          </span>
          <span>
            Vendidas: <strong style={{ color: 'var(--text)' }}>{formatHours(sold)}</strong>
          </span>
          <span>
            Alocadas: <strong style={{ color: exceededProject ? 'var(--danger)' : 'var(--text)' }}>
              {formatHours(allocated)}
            </strong>
          </span>
          <span style={{ color: exceededProject ? 'var(--danger)' : 'var(--text-muted)' }}>
            {exceededProject ? 'Estourado' : `Restantes: `}
            {!exceededProject && <strong style={{ color: 'var(--text)' }}>{formatHours(remaining)}</strong>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stages.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => bulkToggle('collapse')}
                title="Recolher todas as etapas"
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  cursor: 'pointer', color: 'var(--text-muted)',
                  padding: '5px 10px', borderRadius: 6, fontSize: 12,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <ChevronsDownUp size={12} /> Recolher
              </button>
              <button
                type="button"
                onClick={() => bulkToggle('expand')}
                title="Expandir todas as etapas"
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  cursor: 'pointer', color: 'var(--text-muted)',
                  padding: '5px 10px', borderRadius: 6, fontSize: 12,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <ChevronsUpDown size={12} /> Expandir
              </button>
            </>
          )}
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
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="ds-card ds-card-pad"
          style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <div style={{ flex: '1 1 240px' }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Nome
            </label>
            <input
              autoFocus
              className="ds-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Fiscal, Compras, Integrações…"
              maxLength={100}
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div style={{ width: 140 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Horas previstas
            </label>
            <input
              className="ds-input"
              type="number"
              min={0}
              step="0.5"
              value={hours}
              onChange={e => setHours(e.target.value)}
              placeholder="0"
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <button
            type="submit"
            className="ds-btn-primary"
            style={{ fontSize: 13, padding: '8px 14px' }}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Salvando…' : 'Criar'}
          </button>
          <button
            type="button"
            className="ds-btn-ghost"
            style={{ fontSize: 13, padding: '8px 14px' }}
            onClick={() => { setCreating(false); setName(''); setHours('') }}
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Board consolidado: cada etapa renderiza inline (header + alocação + kanban) */}
      {stages.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          color: 'var(--text-muted)',
          border: '1px dashed var(--border)', borderRadius: 8,
        }}>
          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
            Nenhuma etapa ainda
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Crie a primeira frente do projeto (ex: Fiscal, Compras, Integrações).
          </div>
        </div>
      ) : (
        stages.map(stage => (
          <StageOperationalBlock
            key={stage.id}
            stage={stage}
            projectId={projectId}
            canEdit={canEdit}
            onChanged={refetch}
          />
        ))
      )}
    </div>
  )
}
