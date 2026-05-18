'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, Loader2, AlertTriangle, CalendarClock,
  Activity, CheckCircle2, AlertOctagon,
} from 'lucide-react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal'
import { api, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { usePreviewRecalc, type PreviewResult, type RecalcTrigger } from '@/hooks/use-preview-recalc'

interface Props {
  open: boolean
  projectId: number
  trigger: RecalcTrigger | null
  /** Preview já carregado (evita 2ª chamada quando chamador já tem). Opcional. */
  initialPreview?: PreviewResult | null
  /** Modo compacto para usuário executivo. */
  compact?: boolean
  /** Chamado após PATCH + cascade aplicados com sucesso. */
  onApplied: () => void
  /** Chamado quando user cancela (sem PATCH). */
  onCancel: () => void
}

type Mode = 'auto' | 'manual'

/**
 * Modal de recálculo do Cronograma (Fase 10.1).
 *
 * Substitui o antigo RecalcDependentsModal. Diferenças críticas:
 *  - Aparece ANTES do PATCH (preview), não depois (reativo).
 *  - 2 tipos de trigger: delivery_field (cascade FS) e project_calendar (durations).
 *  - 2 modos: auto (aplica cascade sugerida) ou manual (coord ajusta inline).
 *
 * Para trigger=delivery_field:
 *  - "Aplicar Auto": PATCH original + cascade via recalc-dependents apply=true.
 *  - "Aplicar Manual": PATCH original com valores editados pelo coord (sem cascade).
 *
 * Para trigger=project_calendar:
 *  - PATCH do projeto JÁ aconteceu antes (Settings modal). Esse modal é informativo —
 *    só mostra impacto nas durations. Botão "Entendi" fecha (sem novo PATCH).
 */
export function CronogramaRecalcModal({
  open, projectId, trigger, initialPreview = null, compact = false,
  onApplied, onCancel,
}: Props) {
  const previewRecalc = usePreviewRecalc(projectId)
  const [preview, setPreview] = useState<PreviewResult | null>(initialPreview)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [mode, setMode] = useState<Mode>('auto')
  // Manual edits — só pra trigger=delivery_field
  const [manualStart, setManualStart] = useState<string>('')
  const [manualDue, setManualDue] = useState<string>('')
  const [manualHours, setManualHours] = useState<string>('')

  // Carrega preview ao abrir (se não veio pronto)
  useEffect(() => {
    if (!open || !trigger) return
    if (initialPreview) {
      setPreview(initialPreview)
      seedManualFromTrigger(trigger)
      return
    }
    let cancelled = false
    setLoading(true)
    setPreview(null)
    previewRecalc(trigger)
      .then(r => { if (!cancelled) { setPreview(r); seedManualFromTrigger(trigger) } })
      .catch(e => {
        if (cancelled) return
        toast.error(e instanceof ApiError ? e.message : 'Erro ao calcular preview')
        onCancel()
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trigger])

  // Reset mode toda vez que abre
  useEffect(() => {
    if (open) setMode('auto')
  }, [open])

  function seedManualFromTrigger(t: RecalcTrigger) {
    if (t.type !== 'delivery_field') return
    setManualStart(typeof t.simulate.planned_start_at === 'string' ? t.simulate.planned_start_at : '')
    setManualDue(typeof t.simulate.due_date === 'string' ? t.simulate.due_date : '')
    setManualHours(t.simulate.hours_planned != null ? String(t.simulate.hours_planned) : '')
  }

  if (!trigger) return null

  const isCalendar = trigger.type === 'project_calendar'
  const isDelivery = trigger.type === 'delivery_field'

  async function applyAuto() {
    if (!preview) return
    setApplying(true)
    try {
      if (trigger?.type === 'delivery_field') {
        // 1) PATCH do campo original (com valor simulado original)
        await api.patch(`/deliveries/${trigger.deliveryId}`, trigger.simulate)
        // 2) Cascade efetiva
        await api.post(`/deliveries/${trigger.deliveryId}/recalc-dependents`, { apply: true })
        toast.success('Cronograma recalculado')
      } else {
        // Calendar trigger — PATCH do projeto já aconteceu; só fecha
        toast.success('Calendário atualizado')
      }
      onApplied()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao aplicar')
    } finally {
      setApplying(false)
    }
  }

  async function applyManual() {
    if (trigger?.type !== 'delivery_field') return
    const body: Record<string, unknown> = {}
    if (manualStart) body.planned_start_at = manualStart
    if (manualDue)   body.due_date = manualDue
    if (manualHours) body.hours_planned = Number(manualHours)
    if (Object.keys(body).length === 0) {
      toast.error('Nenhum valor manual informado')
      return
    }
    setApplying(true)
    try {
      await api.patch(`/deliveries/${trigger.deliveryId}`, body)
      toast.success('Valor aplicado (sem cascade)')
      onApplied()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao aplicar manualmente')
    } finally {
      setApplying(false)
    }
  }

  // Detecção simples de conflito FS no modo manual: start manual < pred end (informativo)
  const manualConflict = useMemo(() => {
    if (mode !== 'manual' || !isDelivery || !manualStart) return null
    // Sem info do pred end aqui — best effort: se due_date manual < start manual
    if (manualDue && manualDue < manualStart) return 'Fim antes do início.'
    return null
  }, [mode, isDelivery, manualStart, manualDue])

  return (
    <Modal open={open} onClose={onCancel} size={compact ? 'sm' : 'lg'} zIndex={75}>
      <ModalHeader
        title="Recalcular cronograma?"
        subtitle={preview?.summary.trigger_label ?? 'Carregando…'}
        icon={isCalendar ? CalendarClock : Activity}
        onClose={onCancel}
      />
      <ModalBody>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" /> Calculando impacto…
          </div>
        )}

        {!loading && preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 1. Alteração detectada */}
            {!compact && (
              <Section icon={<Activity size={13} />} label="Alteração detectada">
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  {preview.summary.change_description}
                </div>
              </Section>
            )}

            {/* 2. Impacto operacional */}
            <Section icon={<AlertTriangle size={13} />} label="Impacto operacional">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <ImpactCard
                  value={preview.impact.affected_deliveries_count}
                  label="atividade(s)"
                  color={preview.impact.affected_deliveries_count > 0 ? 'warning' : 'success'}
                />
                <ImpactCard
                  value={preview.impact.affected_stages_count}
                  label="etapa(s)"
                  color={preview.impact.affected_stages_count > 0 ? 'warning' : 'success'}
                />
                <ImpactCard
                  value={Math.abs(preview.impact.days_diff)}
                  label={preview.impact.days_diff > 0 ? 'dias de atraso' : preview.impact.days_diff < 0 ? 'dias adiantado' : 'sem mudança de prazo'}
                  color={preview.impact.days_diff > 0 ? 'danger' : preview.impact.days_diff < 0 ? 'success' : 'default'}
                />
              </div>
            </Section>

            {/* 3. Novo prazo do projeto */}
            <Section icon={<CalendarClock size={13} />} label="Prazo final do projeto">
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                fontSize: 14, fontWeight: 600,
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{fmtDate(preview.impact.project_end_current)}</span>
                <ArrowRight size={14} style={{ color: 'var(--text-light)' }} />
                <span style={{
                  color: preview.impact.days_diff > 0 ? 'var(--danger)'
                        : preview.impact.days_diff < 0 ? 'var(--success)'
                        : 'var(--text)',
                }}>
                  {fmtDate(preview.impact.project_end_new)}
                </span>
                {preview.impact.days_diff !== 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 999,
                    background: preview.impact.days_diff > 0 ? 'var(--danger-bg)' : 'var(--success-bg)',
                    color: preview.impact.days_diff > 0 ? 'var(--danger)' : 'var(--success)',
                  }}>
                    {preview.impact.days_diff > 0 ? '+' : ''}{preview.impact.days_diff}d
                  </span>
                )}
              </div>
            </Section>

            {/* 4. Atividades impactadas */}
            {!compact && preview.affected.length > 0 && (
              <Section icon={<AlertOctagon size={13} />} label={`Atividades impactadas (${preview.affected.length})`}>
                <AffectedList items={preview.affected} isCalendar={isCalendar} />
              </Section>
            )}

            {/* 5. Modo de recálculo — só pra delivery_field */}
            {isDelivery && (
              <Section icon={<CheckCircle2 size={13} />} label="Modo de recálculo">
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <ModeRadio
                    checked={mode === 'auto'}
                    onChange={() => setMode('auto')}
                    title="Recalcular automaticamente"
                    desc="Aplica datas sugeridas em todas as atividades dependentes."
                  />
                  <ModeRadio
                    checked={mode === 'manual'}
                    onChange={() => setMode('manual')}
                    title="Definir manualmente"
                    desc="Aplica só esta atividade. Dependentes ficam como estão."
                  />
                </div>
                {mode === 'manual' && (
                  <div style={{
                    marginTop: 10, padding: 10,
                    background: 'var(--surface-hover)', borderRadius: 6,
                    display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
                  }}>
                    <ManualField label="Início">
                      <input
                        type="date" className="ds-input"
                        value={manualStart} onChange={e => setManualStart(e.target.value)}
                        style={{ width: 140, fontSize: 13, padding: '4px 8px' }}
                      />
                    </ManualField>
                    <ManualField label="Fim">
                      <input
                        type="date" className="ds-input"
                        value={manualDue} onChange={e => setManualDue(e.target.value)}
                        style={{ width: 140, fontSize: 13, padding: '4px 8px' }}
                      />
                    </ManualField>
                    <ManualField label="Horas">
                      <input
                        type="number" min={0} step="0.5" className="ds-input"
                        value={manualHours} onChange={e => setManualHours(e.target.value)}
                        style={{ width: 90, fontSize: 13, padding: '4px 8px' }}
                      />
                    </ManualField>
                    {manualConflict && (
                      <div style={{
                        fontSize: 11, color: 'var(--warning)',
                        background: 'var(--warning-bg)',
                        border: '1px solid var(--warning-border)',
                        borderRadius: 4, padding: '4px 8px',
                      }}>
                        ⚠ {manualConflict}
                      </div>
                    )}
                  </div>
                )}
              </Section>
            )}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <button
          type="button" className="ds-btn-secondary"
          onClick={onCancel} disabled={applying}
          style={{ padding: '8px 14px', fontSize: 13 }}
        >
          Cancelar
        </button>
        <button
          type="button" className="ds-btn-primary"
          onClick={mode === 'manual' ? applyManual : applyAuto}
          disabled={loading || applying || !preview}
          style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {applying && <Loader2 size={13} className="animate-spin" />}
          {isCalendar
            ? 'Entendi'
            : mode === 'manual' ? 'Aplicar Manualmente' : 'Aplicar Recálculo'}
        </button>
      </ModalFooter>
    </Modal>
  )
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '.06em',
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 6,
      }}>
        <span style={{ color: 'var(--text-light)' }}>{icon}</span>
        {label}
      </div>
      {children}
    </div>
  )
}

function ImpactCard({ value, label, color }: { value: number; label: string; color: 'default' | 'warning' | 'danger' | 'success' }) {
  const fg = color === 'default' ? 'var(--text)' : `var(--${color})`
  const bg = color === 'default' ? 'var(--surface-hover)' : `var(--${color}-bg)`
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 6,
      background: bg,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: fg, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

interface AffectedListProps {
  items: PreviewResult['affected']
  isCalendar: boolean
}

function AffectedList({ items, isCalendar }: AffectedListProps) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, 10)
  return (
    <div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 12 }}>
        {visible.map(a => (
          <li key={a.id} style={{
            padding: '6px 0',
            borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', gap: 10,
          }}>
            <span style={{ color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.title}
            </span>
            {isCalendar ? (
              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {a.duration_old}d <ArrowRight size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> <strong style={{ color: 'var(--primary)' }}>{a.duration_new}d</strong>
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {fmtRange(a.current_start, a.current_end)} <ArrowRight size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> <strong style={{ color: 'var(--primary)' }}>{fmtRange(a.suggested_start, a.suggested_end)}</strong>
              </span>
            )}
          </li>
        ))}
      </ul>
      {items.length > 10 && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 6, fontSize: 12, color: 'var(--primary)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 0, fontWeight: 500,
          }}
        >
          {expanded ? 'Mostrar menos' : `+${items.length - 10} mais`}
        </button>
      )}
    </div>
  )
}

function ModeRadio({ checked, onChange, title, desc }: { checked: boolean; onChange: () => void; title: string; desc: string }) {
  return (
    <label style={{
      flex: '1 1 200px', cursor: 'pointer',
      padding: '10px 12px',
      border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
      background: checked ? 'var(--primary-soft)' : 'var(--surface)',
      borderRadius: 6,
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <input type="radio" checked={checked} onChange={onChange} style={{ marginTop: 2 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
      </div>
    </label>
  )
}

function ManualField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function fmtRange(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  const s = start ? fmtDate(start) : '?'
  const e = end ? fmtDate(end) : '?'
  return `${s} → ${e}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}`
}
