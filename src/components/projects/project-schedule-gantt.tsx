'use client'

import { useMemo, useState } from 'react'
import type { ScheduleStage, ProjectWindow } from '@/hooks/use-project-schedule'
import type { StageDelivery, DeliveryStatus } from '@/lib/types/project-stage'

interface Props {
  stages: ScheduleStage[]
  projectWindow: ProjectWindow | null
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

export function ProjectScheduleGantt({ stages, projectWindow }: Props) {
  const [zoom, setZoom] = useState<Zoom>('biweek')

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
                return <StageBar key={`s-${row.stage.id}`} stage={row.stage} rowIdx={rowIdx} windowStart={window.start} dayWidth={dayWidth} />
              }
              return (
                <ActivityBar
                  key={`a-${row.activity.id}`}
                  activity={row.activity}
                  rowIdx={rowIdx}
                  windowStart={window.start}
                  dayWidth={dayWidth}
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

function StageBar({ stage, rowIdx, windowStart, dayWidth }: {
  stage: ScheduleStage
  rowIdx: number
  windowStart: Date
  dayWidth: number
}) {
  const start = parseDate(stage.stage_start_at)
  const end   = parseDate(stage.expected_end_date)
  if (!start || !end) return null

  const leftPx  = daysBetween(windowStart, start) * dayWidth
  const widthPx = Math.max(dayWidth, (daysBetween(start, end) + 1) * dayWidth)

  return (
    <div
      title={`${stage.name} · ${start.toLocaleDateString('pt-BR')} → ${end.toLocaleDateString('pt-BR')}`}
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
      }}
    >
      {stage.name}
    </div>
  )
}

function ActivityBar({ activity, rowIdx, windowStart, dayWidth }: {
  activity: StageDelivery
  rowIdx: number
  windowStart: Date
  dayWidth: number
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
  const mainStart = actualStart && actualEnd ? actualStart : plannedStart
  const mainEnd   = actualStart && actualEnd ? actualEnd : plannedEnd
  if (!mainStart || !mainEnd) return null

  const mainLeftPx  = daysBetween(windowStart, mainStart) * dayWidth
  const mainWidthPx = Math.max(dayWidth, (daysBetween(mainStart, mainEnd) + 1) * dayWidth)

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
          opacity: 0.85,
        }}
      >
        {mainWidthPx > 60 ? activity.title : ''}
      </div>
    </>
  )
}
