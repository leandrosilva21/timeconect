'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, Calendar } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import type { ScheduleStage, ProjectCoordinator } from '@/hooks/use-project-schedule'
import type { StageDelivery } from '@/lib/types/project-stage'

interface Props {
  projectId: number
  stages: ScheduleStage[]
  coordinators: ProjectCoordinator[]
  canEdit: boolean
  onChanged: () => void
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatHours(v: number): string {
  if (v === 0) return '0h'
  return v >= 10 ? `${Math.round(v)}h` : `${v.toFixed(1)}h`
}

interface NewStageDraft {
  name: string
  responsible_user_id: string
  stage_start_at: string
  expected_end_date: string
  hours_planned: string
}

interface NewActivityDraft {
  title: string
  responsible_user_id: string
  planned_start_at: string
  due_date: string
  hours_planned: string
}

const emptyStageDraft = (defaultResp: number | null): NewStageDraft => ({
  name: '',
  responsible_user_id: defaultResp ? String(defaultResp) : '',
  stage_start_at: '',
  expected_end_date: '',
  hours_planned: '',
})

const emptyActivityDraft = (defaultResp: number | null): NewActivityDraft => ({
  title: '',
  responsible_user_id: defaultResp ? String(defaultResp) : '',
  planned_start_at: '',
  due_date: '',
  hours_planned: '',
})

export function ProjectScheduleTable({ projectId, stages, coordinators, canEdit, onChanged }: Props) {
  const defaultCoordId = coordinators[0]?.id ?? null

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})
  const [creatingStage, setCreatingStage] = useState(false)
  const [stageDraft, setStageDraft] = useState<NewStageDraft>(emptyStageDraft(defaultCoordId))
  const [creatingActivityIn, setCreatingActivityIn] = useState<number | null>(null)
  const [activityDraft, setActivityDraft] = useState<NewActivityDraft>(emptyActivityDraft(defaultCoordId))

  function toggleCollapse(stageId: number) {
    setCollapsed(c => ({ ...c, [stageId]: !c[stageId] }))
  }

  function openCreateStage() {
    setStageDraft(emptyStageDraft(defaultCoordId))
    setCreatingStage(true)
  }

  function openCreateActivity(stageId: number, stageResp: number | null) {
    setActivityDraft(emptyActivityDraft(stageResp ?? defaultCoordId))
    setCreatingActivityIn(stageId)
  }

  async function createStage() {
    const name = stageDraft.name.trim()
    if (!name) {
      toast.error('Informe o nome da etapa')
      return
    }
    try {
      const body: Record<string, unknown> = { name }
      if (stageDraft.responsible_user_id) body.responsible_user_id = Number(stageDraft.responsible_user_id)
      if (stageDraft.stage_start_at)      body.stage_start_at = stageDraft.stage_start_at
      if (stageDraft.expected_end_date)   body.expected_end_date = stageDraft.expected_end_date
      if (stageDraft.hours_planned)       body.hours_planned = Number(stageDraft.hours_planned)
      await api.post(`/projects/${projectId}/stages`, body)
      setCreatingStage(false)
      setStageDraft(emptyStageDraft(defaultCoordId))
      onChanged()
      toast.success('Etapa criada')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao criar etapa')
    }
  }

  async function createActivity(stageId: number) {
    const title = activityDraft.title.trim()
    if (!title) {
      toast.error('Informe o título da atividade')
      return
    }
    try {
      const body: Record<string, unknown> = { title }
      if (activityDraft.responsible_user_id) body.responsible_user_id = Number(activityDraft.responsible_user_id)
      if (activityDraft.planned_start_at)    body.planned_start_at = activityDraft.planned_start_at
      if (activityDraft.due_date)            body.due_date = activityDraft.due_date
      if (activityDraft.hours_planned)       body.hours_planned = Number(activityDraft.hours_planned)
      await api.post(`/stages/${stageId}/deliveries`, body)
      setCreatingActivityIn(null)
      setActivityDraft(emptyActivityDraft(defaultCoordId))
      onChanged()
      toast.success('Atividade criada')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao criar atividade')
    }
  }

  return (
    <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface-hover)' }}>
            <th style={th()}>Item</th>
            <th style={th()}>Responsável</th>
            <th style={th(110)}>Início</th>
            <th style={th(110)}>Fim</th>
            <th style={th(80)}>Horas</th>
            <th style={th(160)}>Depende de</th>
            <th style={th(60)}></th>
          </tr>
        </thead>
        <tbody>
          {stages.map(stage => {
            const isCollapsed = collapsed[stage.id]
            return (
              <StageRows
                key={stage.id}
                projectId={projectId}
                stage={stage}
                stages={stages}
                coordinators={coordinators}
                collapsed={isCollapsed}
                onToggle={() => toggleCollapse(stage.id)}
                canEdit={canEdit}
                onChanged={onChanged}
                creatingActivity={creatingActivityIn === stage.id}
                activityDraft={activityDraft}
                setActivityDraft={setActivityDraft}
                onStartCreateActivity={() => openCreateActivity(stage.id, stage.responsible_user_id)}
                onCancelCreateActivity={() => { setCreatingActivityIn(null); setActivityDraft(emptyActivityDraft(defaultCoordId)) }}
                onConfirmCreateActivity={() => createActivity(stage.id)}
              />
            )
          })}

          {canEdit && (
            creatingStage ? (
              <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-hover)' }}>
                <td colSpan={7} style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <FieldLabeled label="Nome">
                      <input
                        autoFocus
                        className="ds-input"
                        value={stageDraft.name}
                        onChange={e => setStageDraft(d => ({ ...d, name: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') createStage()
                          if (e.key === 'Escape') setCreatingStage(false)
                        }}
                        placeholder="Ex: Fiscal, Compras…"
                        maxLength={100}
                        style={{ width: 200, fontSize: 13, padding: '4px 8px' }}
                      />
                    </FieldLabeled>
                    <FieldLabeled label="Responsável">
                      <select
                        className="ds-input"
                        value={stageDraft.responsible_user_id}
                        onChange={e => setStageDraft(d => ({ ...d, responsible_user_id: e.target.value }))}
                        style={{ width: 180, fontSize: 13, padding: '4px 8px' }}
                      >
                        <option value="">—</option>
                        {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </FieldLabeled>
                    <FieldLabeled label="Início">
                      <input
                        type="date"
                        className="ds-input"
                        value={stageDraft.stage_start_at}
                        onChange={e => setStageDraft(d => ({ ...d, stage_start_at: e.target.value }))}
                        style={{ width: 130, fontSize: 13, padding: '4px 8px' }}
                      />
                    </FieldLabeled>
                    <FieldLabeled label="Fim">
                      <input
                        type="date"
                        className="ds-input"
                        value={stageDraft.expected_end_date}
                        onChange={e => setStageDraft(d => ({ ...d, expected_end_date: e.target.value }))}
                        style={{ width: 130, fontSize: 13, padding: '4px 8px' }}
                      />
                    </FieldLabeled>
                    <FieldLabeled label="Horas">
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        className="ds-input"
                        value={stageDraft.hours_planned}
                        onChange={e => setStageDraft(d => ({ ...d, hours_planned: e.target.value }))}
                        style={{ width: 80, fontSize: 13, padding: '4px 8px' }}
                      />
                    </FieldLabeled>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={createStage} className="ds-btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}>Criar</button>
                      <button onClick={() => setCreatingStage(false)} className="ds-btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>Cancelar</button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td colSpan={7} style={{ padding: '8px 12px' }}>
                  <button onClick={openCreateStage} style={addBtnStyle()}>
                    <Plus size={12} /> Nova etapa
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}

function th(width?: number): React.CSSProperties {
  return {
    padding: '8px 12px', fontSize: 10, fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '.04em', textAlign: 'left',
    borderBottom: '1px solid var(--border)',
    width: width ? `${width}px` : undefined,
  }
}

function addBtnStyle(): React.CSSProperties {
  return {
    background: 'transparent', border: 'none',
    color: 'var(--text-muted)', cursor: 'pointer',
    fontSize: 12, padding: '4px 8px',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  }
}

function FieldLabeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{
        fontSize: 9, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '.04em',
      }}>
        {label}
      </span>
      {children}
    </label>
  )
}

interface StageRowProps {
  projectId: number
  stage: ScheduleStage
  stages: ScheduleStage[]
  coordinators: ProjectCoordinator[]
  collapsed: boolean
  onToggle: () => void
  canEdit: boolean
  onChanged: () => void
  creatingActivity: boolean
  activityDraft: NewActivityDraft
  setActivityDraft: (next: NewActivityDraft | ((d: NewActivityDraft) => NewActivityDraft)) => void
  onStartCreateActivity: () => void
  onCancelCreateActivity: () => void
  onConfirmCreateActivity: () => void
}

function StageRows(props: StageRowProps) {
  const { stage, coordinators, collapsed, onToggle, canEdit, onChanged, creatingActivity, activityDraft, setActivityDraft, onStartCreateActivity, onCancelCreateActivity, onConfirmCreateActivity } = props

  const allDeliveries = stage.deliveries ?? []

  async function patchStage(field: string, value: unknown) {
    try {
      await api.patch(`/stages/${stage.id}`, { [field]: value })
      onChanged()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao salvar')
    }
  }

  async function deleteStage() {
    if (!confirm(`Excluir a etapa "${stage.name}"?\n\nIsso remove TODAS as atividades dentro dela.`)) return
    try {
      await api.delete(`/stages/${stage.id}`)
      onChanged()
      toast.success('Etapa removida')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao remover')
    }
  }

  return (
    <>
      {/* Linha da etapa (parent, bold) */}
      <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <td style={cell()}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button onClick={onToggle} aria-label="Expandir/recolher" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, marginRight: 4 }}>
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            <InlineText
              value={stage.name}
              canEdit={canEdit}
              onSave={v => patchStage('name', v)}
              bold
            />
          </div>
        </td>
        <td style={cell()}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            {stage.responsible?.name ?? '—'}
          </span>
        </td>
        <td style={cell()}>
          <InlineDate value={stage.stage_start_at ?? null} canEdit={canEdit} onSave={v => patchStage('stage_start_at', v)} placeholder="Definir início" />
        </td>
        <td style={cell()}>
          <InlineDate value={stage.expected_end_date ?? null} canEdit={canEdit} onSave={v => patchStage('expected_end_date', v)} placeholder="Definir fim" />
        </td>
        <td style={cell()}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            {formatHours(num(stage.deliveries_hours_planned_sum))}
          </span>
        </td>
        <td style={cell()}>—</td>
        <td style={cell()}>
          {canEdit && (
            <button onClick={deleteStage} aria-label="Excluir etapa" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
              <Trash2 size={12} />
            </button>
          )}
        </td>
      </tr>

      {/* Atividades indentadas */}
      {!collapsed && allDeliveries.map(d => (
        <ActivityRow key={d.id} delivery={d} stageDeliveries={allDeliveries} canEdit={canEdit} onChanged={onChanged} />
      ))}

      {/* Linha de criação */}
      {!collapsed && canEdit && (
        creatingActivity ? (
          <tr style={{ background: 'var(--surface-hover)' }}>
            <td colSpan={7} style={{ padding: '10px 12px 10px 36px' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <FieldLabeled label="Título">
                  <input
                    autoFocus
                    className="ds-input"
                    value={activityDraft.title}
                    onChange={e => setActivityDraft(d => ({ ...d, title: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') onConfirmCreateActivity()
                      if (e.key === 'Escape') onCancelCreateActivity()
                    }}
                    placeholder="Ex: SPED Fiscal…"
                    maxLength={200}
                    style={{ width: 220, fontSize: 13, padding: '4px 8px' }}
                  />
                </FieldLabeled>
                <FieldLabeled label="Responsável">
                  <select
                    className="ds-input"
                    value={activityDraft.responsible_user_id}
                    onChange={e => setActivityDraft(d => ({ ...d, responsible_user_id: e.target.value }))}
                    style={{ width: 180, fontSize: 13, padding: '4px 8px' }}
                  >
                    <option value="">—</option>
                    {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </FieldLabeled>
                <FieldLabeled label="Início">
                  <input
                    type="date"
                    className="ds-input"
                    value={activityDraft.planned_start_at}
                    onChange={e => setActivityDraft(d => ({ ...d, planned_start_at: e.target.value }))}
                    style={{ width: 130, fontSize: 13, padding: '4px 8px' }}
                  />
                </FieldLabeled>
                <FieldLabeled label="Fim">
                  <input
                    type="date"
                    className="ds-input"
                    value={activityDraft.due_date}
                    onChange={e => setActivityDraft(d => ({ ...d, due_date: e.target.value }))}
                    style={{ width: 130, fontSize: 13, padding: '4px 8px' }}
                  />
                </FieldLabeled>
                <FieldLabeled label="Horas">
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    className="ds-input"
                    value={activityDraft.hours_planned}
                    onChange={e => setActivityDraft(d => ({ ...d, hours_planned: e.target.value }))}
                    style={{ width: 80, fontSize: 13, padding: '4px 8px' }}
                  />
                </FieldLabeled>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={onConfirmCreateActivity} className="ds-btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}>Criar</button>
                  <button onClick={onCancelCreateActivity} className="ds-btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>Cancelar</button>
                </div>
              </div>
            </td>
          </tr>
        ) : (
          <tr>
            <td colSpan={7} style={{ padding: '4px 12px 4px 36px' }}>
              <button onClick={onStartCreateActivity} style={addBtnStyle()}>
                <Plus size={12} /> Nova atividade
              </button>
            </td>
          </tr>
        )
      )}
    </>
  )
}

function ActivityRow({ delivery, stageDeliveries, canEdit, onChanged }: {
  delivery: StageDelivery
  stageDeliveries: StageDelivery[]
  canEdit: boolean
  onChanged: () => void
}) {
  async function patch(field: string, value: unknown) {
    try {
      await api.patch(`/deliveries/${delivery.id}`, { [field]: value })
      onChanged()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao salvar')
    }
  }

  async function del() {
    if (!confirm(`Excluir a atividade "${delivery.title}"?`)) return
    try {
      await api.delete(`/deliveries/${delivery.id}`)
      onChanged()
      toast.success('Atividade removida')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao remover')
    }
  }

  const dependsOn = delivery.depends_on_delivery_id
    ? stageDeliveries.find(d => d.id === delivery.depends_on_delivery_id)
    : null

  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td style={{ ...cell(), paddingLeft: 36 }}>
        <InlineText value={delivery.title} canEdit={canEdit} onSave={v => patch('title', v)} />
      </td>
      <td style={cell()}>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {delivery.responsible?.name ?? <em style={{ color: 'var(--danger)' }}>sem responsável</em>}
        </span>
      </td>
      <td style={cell()}>
        <InlineDate value={delivery.planned_start_at ?? null} canEdit={canEdit} onSave={v => patch('planned_start_at', v)} placeholder="Definir início" />
      </td>
      <td style={cell()}>
        <InlineDate value={delivery.due_date ?? null} canEdit={canEdit} onSave={v => patch('due_date', v)} placeholder="Definir fim" />
      </td>
      <td style={cell()}>
        <InlineNumber value={num(delivery.hours_planned)} canEdit={canEdit} onSave={v => patch('hours_planned', v)} />
      </td>
      <td style={cell()}>
        <InlineDependencySelect
          value={delivery.depends_on_delivery_id ?? null}
          options={stageDeliveries.filter(d => d.id !== delivery.id)}
          canEdit={canEdit}
          onSave={v => patch('depends_on_delivery_id', v)}
        />
      </td>
      <td style={cell()}>
        {canEdit && (
          <button onClick={del} aria-label="Excluir atividade" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <Trash2 size={12} />
          </button>
        )}
      </td>
    </tr>
  )
}

function cell(): React.CSSProperties {
  return { padding: '6px 12px', verticalAlign: 'middle' }
}

function InlineText({ value, canEdit, onSave, bold }: {
  value: string
  canEdit: boolean
  onSave: (v: string) => void
  bold?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editing) {
    return (
      <span
        onClick={() => { if (canEdit) { setDraft(value); setEditing(true) } }}
        style={{
          cursor: canEdit ? 'text' : 'default',
          fontWeight: bold ? 600 : 400,
          color: 'var(--text)',
        }}
      >
        {value || <em style={{ color: 'var(--text-light)' }}>—</em>}
      </span>
    )
  }
  return (
    <input
      autoFocus
      className="ds-input"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onSave(draft); setEditing(false) }}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.currentTarget.blur() }
        if (e.key === 'Escape') { setDraft(value); setEditing(false) }
      }}
      style={{ fontSize: 13, padding: '2px 6px', width: '100%', fontWeight: bold ? 600 : 400 }}
    />
  )
}

function InlineDate({ value, canEdit, onSave, placeholder = 'Definir' }: {
  value: string | null
  canEdit: boolean
  onSave: (v: string | null) => void
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ? value.slice(0, 10) : '')

  if (!editing) {
    return (
      <span
        onClick={() => { if (canEdit) { setDraft(value ? value.slice(0, 10) : ''); setEditing(true) } }}
        style={{
          cursor: canEdit ? 'pointer' : 'default',
          fontSize: 12,
          color: value ? 'var(--text)' : (canEdit ? 'var(--primary)' : 'var(--text-light)'),
          fontVariantNumeric: 'tabular-nums',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontStyle: value ? 'normal' : 'italic',
        }}
      >
        {value ? (
          new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        ) : (
          canEdit ? (<><Calendar size={11} /> {placeholder}</>) : <>—</>
        )}
      </span>
    )
  }
  return (
    <input
      autoFocus
      type="date"
      className="ds-input"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        const newVal = draft || null
        if (newVal !== value) onSave(newVal)
        setEditing(false)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
      }}
      style={{ fontSize: 12, padding: '2px 6px', width: 110 }}
    />
  )
}

function InlineNumber({ value, canEdit, onSave }: {
  value: number
  canEdit: boolean
  onSave: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  if (!editing) {
    return (
      <span
        onClick={() => { if (canEdit) { setDraft(String(value)); setEditing(true) } }}
        style={{
          cursor: canEdit ? 'text' : 'default',
          fontSize: 12, fontVariantNumeric: 'tabular-nums',
          color: value > 0 ? 'var(--text)' : 'var(--text-light)',
        }}
      >
        {value > 0 ? formatHours(value) : '—'}
      </span>
    )
  }
  return (
    <input
      autoFocus
      type="number"
      min={0}
      step="0.5"
      className="ds-input"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft)
        if (Number.isFinite(n) && n !== value) onSave(n)
        setEditing(false)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { setDraft(String(value)); setEditing(false) }
      }}
      style={{ fontSize: 12, padding: '2px 6px', width: 70 }}
    />
  )
}

function InlineDependencySelect({ value, options, canEdit, onSave }: {
  value: number | null
  options: StageDelivery[]
  canEdit: boolean
  onSave: (v: number | null) => void
}) {
  const selected = value ? options.find(o => o.id === value) : null

  if (!canEdit) {
    return (
      <span style={{ fontSize: 12, color: selected ? 'var(--text)' : 'var(--text-light)' }}>
        {selected ? selected.title : '—'}
      </span>
    )
  }
  return (
    <select
      className="ds-input"
      value={value ?? ''}
      onChange={e => {
        const v = e.target.value
        onSave(v === '' ? null : Number(v))
      }}
      style={{ fontSize: 12, padding: '2px 6px', width: '100%' }}
    >
      <option value="">—</option>
      {options.map(o => (
        <option key={o.id} value={o.id}>{o.title}</option>
      ))}
    </select>
  )
}
