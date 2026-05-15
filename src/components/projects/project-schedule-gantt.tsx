'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import type { ScheduleStage, ProjectWindow } from '@/hooks/use-project-schedule'
import type { StageDelivery, DeliveryStatus } from '@/lib/types/project-stage'

interface Props {
  stages: ScheduleStage[]
  projectWindow: ProjectWindow | null
  canEdit?: boolean
  onChanged?: () => void
}

type DragMode = 'move' | 'resize-start' | 'resize-end'

interface DragState {
  kind: 'stage' | 'activity'
  id: number
  mode: DragMode
  startX: number
  startDate: Date
  endDate: Date
  deltaDays: number // current delta during drag (snapped to days)
}

type Zoom = 'week' | 'biweek' | 'month'

const ZOOM_PX: Record<Zoom, number> = {
  week: 22,    // 1 day = 22px
  biweek: 12,  // 1 day = 12px
  month: 6,    // 1 day = 6px
}

const STATUS_COLOR: Record<DeliveryStatus, string> = {
  backlog:        'var(--text-muted)',
  in_progress:    'var(--primary)',
  waiting_client: 'var(--danger)',
  review:         'var(--warning)',
  done:           'var(--success)',
}

const ROW_HEIGHT = 28
const HEADER_HEIGHT = 40

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toIso(d: Date): string {
  // YYYY-MM-DD em UTC pra evitar shift por timezone
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function ProjectScheduleGantt({ stages, projectWindow, canEdit = true, onChanged }: Props) {
  const [zoom, setZoom] = useState<Zoom>('biweek')
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag

  // Janela do Gantt: usa projectWindow + padding de 7 dias antes/depois pra dar respiro
  const window = useMemo(() => {
    const start = parseDate(projectWindow?.start ?? null) ?? new Date()
    const end   = parseDate(projectWindow?.end ?? null) ?? addDays(start, 30)
    return {
      start: addDays(start, -7),
      end:   addDays(end, 7),
    }
  }, [projectWindow?.start, projectWindow?.end])

  const dayWidth = ZOOM_PX[zoom]
  const totalDays = Math.max(1, daysBetween(window.start, window.end) + 1)
  const widthPx = totalDays * dayWidth

  // Flatten rows (stage row + activity rows) para o layout vertical
  type Row = { kind: 'stage'; stage: ScheduleStage } | { kind: 'activity'; activity: StageDelivery; stageId: number }
  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    for (const s of stages) {
      out.push({ kind: 'stage', stage: s })
      for (const d of s.deliveries ?? []) {
        out.push({ kind: 'activity', activity: d, stageId: s.id })
      }
    }
    return out
  }, [stages])

  // Build dependency lookup for arrow rendering
  const activityRowIndex = useMemo(() => {
    const map = new Map<number, number>() // delivery_id → row index
    rows.forEach((r, i) => {
      if (r.kind === 'activity') map.set(r.activity.id, i)
    })
    return map
  }, [rows])

  // Header columns (month labels + day grid)
  const months = useMemo(() => {
    const result: { label: string; offsetPx: number }[] = []
    let cur = new Date(window.start)
    cur.setDate(1) // primeiro dia do mês
    while (cur <= window.end) {
      const offset = daysBetween(window.start, cur)
      if (offset >= 0) {
        result.push({
          label: cur.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          offsetPx: offset * dayWidth,
        })
      }
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
    return result
  }, [window.start, window.end, dayWidth])

  // Today indicator
  const today = new Date()
  const todayOffset = daysBetween(window.start, today)
  const todayVisible = todayOffset >= 0 && todayOffset <= totalDays

  // ─── Drag temporal ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!drag) return

    function onMove(e: MouseEvent) {
      const cur = dragRef.current
      if (!cur) return
      const dx = e.clientX - cur.startX
      const deltaDays = Math.round(dx / dayWidth)
      if (deltaDays !== cur.deltaDays) {
        setDrag({ ...cur, deltaDays })
      }
    }

    async function onUp(_e: MouseEvent) {
      const cur = dragRef.current
      setDrag(null)
      if (!cur) return
      if (cur.deltaDays === 0) return

      try {
        if (cur.kind === 'stage') {
          const newStart = cur.mode !== 'resize-end' ? addDays(cur.startDate, cur.deltaDays) : cur.startDate
          const newEnd   = cur.mode !== 'resize-start' ? addDays(cur.endDate, cur.deltaDays) : cur.endDate
          await api.patch(`/stages/${cur.id}`, {
            stage_start_at:    toIso(newStart),
            expected_end_date: toIso(newEnd),
          })
        } else {
          const newStart = cur.mode !== 'resize-end' ? addDays(cur.startDate, cur.deltaDays) : cur.startDate
          const newEnd   = cur.mode !== 'resize-start' ? addDays(cur.endDate, cur.deltaDays) : cur.endDate
          await api.patch(`/deliveries/${cur.id}`, {
            planned_start_at: toIso(newStart),
            due_date:         toIso(newEnd),
          })
        }
        onChanged?.()
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Erro ao salvar movimentação')
        onChanged?.() // refetch reverte visualmente
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null, dayWidth])

  function startDrag(kind: 'stage' | 'activity', id: number, mode: DragMode, startDate: Date, endDate: Date, mouseX: number) {
    if (!canEdit) return
    setDrag({ kind, id, mode, startX: mouseX, startDate, endDate, deltaDays: 0 })
  }

  return (
    <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-hover)',
        fontSize: 12,
      }}>
        <span style={{ color: 'var(--text-muted)' }}>
          Gantt · {totalDays} dias · zoom {zoom === 'week' ? 'semana' : zoom === 'biweek' ? '2 semanas' : 'mês'}
        </span>
        <div style={{ display: 'inline-flex', gap: 4 }}>
          {(['week', 'biweek', 'month'] as Zoom[]).map(z => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              style={{
                padding: '3px 8px', fontSize: 11,
                background: zoom === z ? 'var(--primary)' : 'transparent',
                color: zoom === z ? 'var(--primary-fg)' : 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: zoom === z ? 600 : 400,
              }}
            >
              {z === 'week' ? 'Semana' : z === 'biweek' ? '2 sem' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* Gantt body */}
      <div style={{ overflowX: 'auto', position: 'relative' }}>
        <div style={{ width: widthPx, position: 'relative' }}>
          {/* Header: months */}
          <div style={{
            height: HEADER_HEIGHT,
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg)',
            position: 'sticky',
            top: 0, zIndex: 2,
            overflow: 'hidden',
          }}>
            {months.map((m, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: m.offsetPx,
                top: 8,
                fontSize: 11, fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '.04em',
                paddingLeft: 4,
              }}>
                {m.label}
              </div>
            ))}
            {/* Vertical grid lines per week */}
            {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, i) => (
              <div key={`gl-${i}`} style={{
                position: 'absolute',
                left: i * 7 * dayWidth,
                top: 0, bottom: 0,
                width: 1,
                background: 'var(--border)',
                opacity: 0.5,
              }} />
            ))}
          </div>

          {/* Rows */}
          <div style={{ position: 'relative', minHeight: rows.length * ROW_HEIGHT }}>
            {/* Vertical grid lines per week (body) */}
            {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, i) => (
              <div key={`gv-${i}`} style={{
                position: 'absolute',
                left: i * 7 * dayWidth,
                top: 0, bottom: 0,
                width: 1,
                background: 'var(--border)',
                opacity: 0.3,
                pointerEvents: 'none',
              }} />
            ))}

            {/* Today indicator */}
            {todayVisible && (
              <div style={{
                position: 'absolute',
                left: todayOffset * dayWidth,
                top: 0, bottom: 0,
                width: 2,
                background: 'var(--danger)',
                opacity: 0.7,
                pointerEvents: 'none',
                zIndex: 1,
              }} title="Hoje" />
            )}

            {/* Bars */}
            {rows.map((row, rowIdx) => {
              if (row.kind === 'stage') {
                return (
                  <StageBar
                    key={`s-${row.stage.id}`}
                    stage={row.stage}
                    rowIdx={rowIdx}
                    windowStart={window.start}
                    dayWidth={dayWidth}
                    canEdit={canEdit}
                    drag={drag && drag.kind === 'stage' && drag.id === row.stage.id ? drag : null}
                    onDragStart={(mode, start, end, mouseX) => startDrag('stage', row.stage.id, mode, start, end, mouseX)}
                  />
                )
              }
              return (
                <ActivityBar
                  key={`a-${row.activity.id}`}
                  activity={row.activity}
                  rowIdx={rowIdx}
                  windowStart={window.start}
                  dayWidth={dayWidth}
                  canEdit={canEdit}
                  drag={drag && drag.kind === 'activity' && drag.id === row.activity.id ? drag : null}
                  onDragStart={(mode, start, end, mouseX) => startDrag('activity', row.activity.id, mode, start, end, mouseX)}
                />
              )
            })}

            {/* Dependency arrows (SVG overlay) */}
            <svg
              width={widthPx}
              height={rows.length * ROW_HEIGHT}
              style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
            >
              {rows.map((row, rowIdx) => {
                if (row.kind !== 'activity') return null
                const depId = row.activity.depends_on_delivery_id
                if (!depId) return null
                const depRow = activityRowIndex.get(depId)
                if (depRow === undefined) return null

                const depActivity = (rows[depRow] as Extract<Row, { kind: 'activity' }>).activity
                const fromEnd = parseDate(depActivity.due_date)
                const toStart = parseDate(row.activity.planned_start_at)
                if (!fromEnd || !toStart) return null

                const x1 = (daysBetween(window.start, fromEnd) + 1) * dayWidth
                const y1 = depRow * ROW_HEIGHT + ROW_HEIGHT / 2
                const x2 = daysBetween(window.start, toStart) * dayWidth
                const y2 = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2

                // Linha vermelha se a dependência termina depois do dependente começar
                const violated = fromEnd > toStart
                const color = violated ? 'var(--danger)' : 'var(--text-muted)'

                return (
                  <g key={`dep-${row.activity.id}`}>
                    <path
                      d={`M ${x1} ${y1} L ${x1 + 6} ${y1} L ${x1 + 6} ${y2} L ${x2 - 2} ${y2}`}
                      stroke={color}
                      strokeWidth={1.5}
                      fill="none"
                      opacity={0.7}
                    />
                    <path
                      d={`M ${x2 - 2} ${y2} L ${x2 - 6} ${y2 - 3} L ${x2 - 6} ${y2 + 3} Z`}
                      fill={color}
                      opacity={0.7}
                    />
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

function StageBar({ stage, rowIdx, windowStart, dayWidth, canEdit, drag, onDragStart }: {
  stage: ScheduleStage
  rowIdx: number
  windowStart: Date
  dayWidth: number
  canEdit: boolean
  drag: DragState | null
  onDragStart: (mode: DragMode, start: Date, end: Date, mouseX: number) => void
}) {
  const start = parseDate(stage.stage_start_at)
  const end   = parseDate(stage.expected_end_date)
  if (!start || !end) return null

  // Aplica delta do drag em curso (otimista)
  let drawStart = start
  let drawEnd   = end
  if (drag) {
    if (drag.mode !== 'resize-end') drawStart = addDays(start, drag.deltaDays)
    if (drag.mode !== 'resize-start') drawEnd  = addDays(end, drag.deltaDays)
  }

  const leftPx  = daysBetween(windowStart, drawStart) * dayWidth
  const widthPx = Math.max(dayWidth, (daysBetween(drawStart, drawEnd) + 1) * dayWidth)

  return (
    <div
      title={`${stage.name} · ${drawStart.toLocaleDateString('pt-BR')} → ${drawEnd.toLocaleDateString('pt-BR')}`}
      style={{
        position: 'absolute',
        top: rowIdx * ROW_HEIGHT + 6,
        left: leftPx,
        width: widthPx,
        height: 16,
        background: 'var(--primary-soft)',
        border: '1px solid var(--primary)',
        borderRadius: 4,
        fontSize: 11,
        color: 'var(--primary)',
        fontWeight: 600,
        paddingLeft: 6, paddingRight: 6,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        lineHeight: '14px',
        cursor: canEdit ? (drag ? 'grabbing' : 'grab') : 'default',
        opacity: drag ? 0.7 : 1,
        userSelect: 'none',
      }}
      onMouseDown={canEdit ? e => { e.preventDefault(); onDragStart('move', start, end, e.clientX) } : undefined}
    >
      {canEdit && <ResizeHandle side="start" onDragStart={(mouseX) => onDragStart('resize-start', start, end, mouseX)} />}
      {stage.name}
      {canEdit && <ResizeHandle side="end" onDragStart={(mouseX) => onDragStart('resize-end', start, end, mouseX)} />}
    </div>
  )
}

function ActivityBar({ activity, rowIdx, windowStart, dayWidth, canEdit, drag, onDragStart }: {
  activity: StageDelivery
  rowIdx: number
  windowStart: Date
  dayWidth: number
  canEdit: boolean
  drag: DragState | null
  onDragStart: (mode: DragMode, start: Date, end: Date, mouseX: number) => void
}) {
  const plannedStart = parseDate(activity.planned_start_at)
  const plannedEnd   = parseDate(activity.due_date)
  const actualStart  = parseDate(activity.actual_start_at)
  const actualEnd    = parseDate(activity.completed_at)

  if (!plannedStart && !plannedEnd && !actualStart && !actualEnd) return null

  // Bar planejada (cinza fantasma se houver diff com real)
  const plannedColor = STATUS_COLOR[activity.status]
  const hasPlanned = plannedStart && plannedEnd
  const hasActual  = actualStart && actualEnd
  const showGhost  = hasPlanned && hasActual && (
    daysBetween(plannedStart!, actualStart!) !== 0 || daysBetween(plannedEnd!, actualEnd!) !== 0
  )

  // Bar principal (real se completed, senão planned)
  // Drag opera sobre o planejado (planned_start_at + due_date)
  let mainStart = actualStart && actualEnd ? actualStart : plannedStart
  let mainEnd   = actualStart && actualEnd ? actualEnd : plannedEnd
  if (drag && plannedStart && plannedEnd) {
    if (drag.mode !== 'resize-end') mainStart = addDays(plannedStart, drag.deltaDays)
    if (drag.mode !== 'resize-start') mainEnd  = addDays(plannedEnd, drag.deltaDays)
  }
  if (!mainStart || !mainEnd) return null

  const mainLeftPx  = daysBetween(windowStart, mainStart) * dayWidth
  const mainWidthPx = Math.max(dayWidth, (daysBetween(mainStart, mainEnd) + 1) * dayWidth)
  const canDrag = canEdit && hasPlanned

  return (
    <>
      {/* Ghost (planejado) — só aparece se actual diverge */}
      {showGhost && plannedStart && plannedEnd && (
        <div style={{
          position: 'absolute',
          top: rowIdx * ROW_HEIGHT + 8,
          left: daysBetween(windowStart, plannedStart) * dayWidth,
          width: Math.max(dayWidth, (daysBetween(plannedStart, plannedEnd) + 1) * dayWidth),
          height: 12,
          background: 'transparent',
          border: '1px dashed var(--text-muted)',
          borderRadius: 3,
          opacity: 0.5,
        }} title="Planejado" />
      )}

      {/* Bar real ou planejada */}
      <div
        title={
          `${activity.title} · ${mainStart.toLocaleDateString('pt-BR')} → ${mainEnd.toLocaleDateString('pt-BR')}` +
          ` · ${activity.hours_planned}h` +
          (activity.responsible?.name ? ` · ${activity.responsible.name}` : '') +
          (hasActual ? ' (real)' : ' (planejado)')
        }
        style={{
          position: 'absolute',
          top: rowIdx * ROW_HEIGHT + 8,
          left: mainLeftPx,
          width: mainWidthPx,
          height: 12,
          background: plannedColor,
          borderRadius: 3,
          fontSize: 10,
          color: 'var(--primary-fg)',
          paddingLeft: 4, paddingRight: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: '12px',
          opacity: drag ? 0.6 : 0.85,
          cursor: canDrag ? (drag ? 'grabbing' : 'grab') : 'default',
          userSelect: 'none',
        }}
        onMouseDown={canDrag ? e => { e.preventDefault(); onDragStart('move', plannedStart!, plannedEnd!, e.clientX) } : undefined}
      >
        {canDrag && <ResizeHandle side="start" onDragStart={(mouseX) => onDragStart('resize-start', plannedStart!, plannedEnd!, mouseX)} />}
        {mainWidthPx > 60 ? activity.title : ''}
        {canDrag && <ResizeHandle side="end" onDragStart={(mouseX) => onDragStart('resize-end', plannedStart!, plannedEnd!, mouseX)} />}
      </div>
    </>
  )
}

function ResizeHandle({ side, onDragStart }: {
  side: 'start' | 'end'
  onDragStart: (mouseX: number) => void
}) {
  return (
    <div
      onMouseDown={e => {
        e.preventDefault()
        e.stopPropagation()
        onDragStart(e.clientX)
      }}
      style={{
        position: 'absolute',
        top: 0, bottom: 0,
        [side === 'start' ? 'left' : 'right']: -3,
        width: 6,
        cursor: 'ew-resize',
        zIndex: 2,
      }}
    />
  )
}
