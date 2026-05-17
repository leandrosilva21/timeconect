'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ApiError, api } from '@/lib/api'
import { toast } from 'sonner'
import {
  Info, Plus, Eye, EyeOff,
  Layers, CheckSquare, Play, Lock, UserCheck,
} from 'lucide-react'
import { useProjectSchedule } from '@/hooks/use-project-schedule'
import { useAuth } from '@/hooks/use-auth'
import { useExecutiveMode } from '@/hooks/use-executive-mode'
import { KpiCard } from '@/components/ui/kpi-card'
import type { ProjectStage } from '@/lib/types/project-stage'
import { BoardView } from './views/board'
import { TabelaView } from './views/tabela'
import { GanttView } from './views/gantt'

type ViewMode = 'board' | 'tabela' | 'gantt'
const ALLOWED_VIEWS: ViewMode[] = ['board', 'tabela', 'gantt']
const LS_KEY = (projectId: number) => `cronograma:view:${projectId}`

/**
 * Hub do Cronograma — view única (ADR 0009): board (kanban macro de etapas),
 * tabela (linha-a-linha editável) e Gantt são modos da mesma fonte.
 * View atual em `?view=board|tabela|gantt` (default board).
 */
export default function CronogramaPage() {
  const params = useParams<{ id: string }>()
  const projectId = Number(params.id)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const canEdit = user?.type !== 'consultor' && user?.type !== 'cliente'
  const [executive, toggleExecutive] = useExecutiveMode()
  const [highlightUserId, setHighlightUserId] = useState<number | null>(null)

  const view: ViewMode = (() => {
    const v = searchParams.get('view')
    return ALLOWED_VIEWS.includes(v as ViewMode) ? (v as ViewMode) : 'board'
  })()

  const { isOperational, project, stages, projectWindow, holidays, loading, error, refetch } =
    useProjectSchedule(projectId)

  // Restore last-used view do localStorage quando entra sem ?view= explícito
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (searchParams.has('view')) return
    const last = window.localStorage.getItem(LS_KEY(projectId))
    if (last && ALLOWED_VIEWS.includes(last as ViewMode) && last !== 'board') {
      const sp = new URLSearchParams(searchParams.toString())
      sp.set('view', last)
      router.replace(`?${sp.toString()}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  function setView(v: ViewMode) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('view', v)
    router.replace(`?${sp.toString()}`)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY(projectId), v)
    }
  }

  const counts = useMemo(() => {
    const totalActivities = stages.reduce((s, st) => s + (st.deliveries?.length ?? 0), 0)
    const totalHoursPlanned = stages.reduce((s, st) =>
      s + (st.deliveries?.reduce((sub, d) => sub + (Number(d.hours_planned) || 0), 0) ?? 0)
    , 0)
    const inProgressCount = stages.reduce((s, st) => s + (st.deliveries_in_progress_count ?? 0), 0)
    const waitingClientCount = stages.reduce((s, st) => s + (st.deliveries_waiting_client_count ?? 0), 0)
    const blockedCount = stages.reduce((s, st) =>
      s + (st.deliveries?.filter(d => d.predecessor_state === 'pending').length ?? 0)
    , 0)
    return { totalActivities, totalHoursPlanned, inProgressCount, waitingClientCount, blockedCount }
  }, [stages])

  // Form criar etapa (vive aqui, no hub)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [hours, setHours] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreateStage(e: React.FormEvent) {
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

  return (
    <div>
      {/* Strip de KPIs operacionais */}
      <div style={{
        display: 'grid', gap: 8, marginBottom: 12,
        gridTemplateColumns: executive
          ? 'repeat(auto-fit, minmax(160px, 1fr))'
          : 'repeat(auto-fit, minmax(160px, 1fr))',
      }}>
        <KpiCard label="Etapas"     value={stages.length}                icon={Layers}      accent="default" />
        <KpiCard label="Atividades" value={counts.totalActivities}        icon={CheckSquare} accent="default"
                 hint={`${Math.round(counts.totalHoursPlanned)}h planejadas`} />
        {!executive && (
          <KpiCard label="Em execução" value={counts.inProgressCount} icon={Play} accent="primary" />
        )}
        <KpiCard label="Bloqueadas" value={counts.blockedCount} icon={Lock}
                 accent={counts.blockedCount > 0 ? 'danger' : 'default'} />
        {!executive && (
          <KpiCard label="Aguardando cliente" value={counts.waitingClientCount} icon={UserCheck}
                   accent={counts.waitingClientCount > 0 ? 'warning' : 'default'} />
        )}
      </div>

      {/* Toolbar: segmented control + ações */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 16,
      }}>
        <SegmentedControl current={view} onChange={setView} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {project && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Saldo do projeto: <strong style={{ color: 'var(--text)' }}>{project.sold_hours}h</strong>
            </span>
          )}
          <button
            type="button"
            onClick={() => toggleExecutive()}
            title={executive ? 'Sair do modo executivo' : 'Ativar modo executivo — esconde detalhes operacionais'}
            className="ds-btn-ghost"
            style={{
              fontSize: 12, padding: '6px 10px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: executive ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: executive ? 600 : 400,
            }}
          >
            {executive ? <EyeOff size={12} /> : <Eye size={12} />}
            Modo executivo
          </button>
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
          onSubmit={handleCreateStage}
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

      {/* Banner: cronograma é uma fonte só */}
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
          Cronograma é a camada operacional do projeto: <strong>Board</strong>, <strong>Tabela</strong> e <strong>Gantt</strong> são views da mesma fonte (ADR 0009).
        </span>
      </div>

      {/* View ativa */}
      {view === 'board'  && <BoardView  projectId={projectId} stages={stages} />}
      {view === 'tabela' && (
        <TabelaView
          projectId={projectId}
          stages={stages}
          coordinators={project?.coordinators ?? []}
          canEdit={canEdit}
          holidays={holidays}
          onChanged={refetch}
        />
      )}
      {view === 'gantt' && (
        <GanttView
          stages={stages}
          projectWindow={projectWindow}
          canEdit={canEdit}
          highlightUserId={highlightUserId}
          onSelectUser={setHighlightUserId}
          onChanged={refetch}
        />
      )}
    </div>
  )
}

function SegmentedControl({ current, onChange }: { current: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { value: ViewMode; label: string }[] = [
    { value: 'board',  label: 'Board' },
    { value: 'tabela', label: 'Tabela' },
    { value: 'gantt',  label: 'Gantt' },
  ]
  return (
    <div style={{
      display: 'inline-flex',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      background: 'var(--surface)',
    }}>
      {opts.map((opt, i) => {
        const active = current === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={active ? 'ds-tab-active' : 'ds-tab-inactive'}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              background: active ? 'var(--primary-soft)' : 'transparent',
              color: active ? 'var(--primary)' : 'var(--text-muted)',
              border: 'none',
              borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
