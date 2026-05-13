'use client'

import { AppLayout } from '@/components/layout/app-layout'
import Link from 'next/link'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  Users as UsersIcon, Check, X, ExternalLink, RefreshCw,
} from 'lucide-react'

type CandStatus = 'new' | 'screening' | 'interview' | 'approved' | 'rejected' | 'hired' | 'allocated'

interface Candidate {
  id: number
  name: string
  email: string
  phone: string | null
  city: string | null
  state: string | null
  work_model: string | null
  availability_status: string | null
  availability: number
  hourly_rate: number | null
  protheus_years_experience: number | null
  status: CandStatus
  score_initial: number | null
  interest_level: string | null
  expected_rate: number | null
  notes: string | null
  top_skills: Array<{ name: string; level: string }>
}

const COLUMNS: Array<{ status: CandStatus; label: string; color: string; bg: string }> = [
  { status: 'new',        label: 'Novo',        color: 'var(--text-muted)',     bg: 'transparent' },
  { status: 'screening',  label: 'Triagem',     color: 'var(--primary)',        bg: 'var(--primary-soft)' },
  { status: 'interview',  label: 'Entrevista',  color: 'var(--warning)',        bg: 'var(--warning-bg)' },
  { status: 'approved',   label: 'Aprovado',    color: 'var(--success)',        bg: 'var(--success-bg)' },
  { status: 'allocated',  label: 'Alocado',     color: 'var(--success)',        bg: 'var(--success-bg)' },
  { status: 'rejected',   label: 'Rejeitado',   color: 'var(--danger)',         bg: 'var(--danger-bg)' },
]

export default function CandidatosKanbanPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<CandStatus | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get<{ candidates: Candidate[] }>('/candidates')
      setCandidates(r.candidates ?? [])
    } catch {
      toast.error('Erro ao carregar candidatos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Agrupar por status (consolida 'hired' dentro de 'allocated' pra simplificar visualização)
  const byStatus = useMemo(() => {
    const map = new Map<CandStatus, Candidate[]>()
    COLUMNS.forEach(c => map.set(c.status, []))
    candidates.forEach(c => {
      const status: CandStatus = c.status === 'hired' ? 'allocated' : c.status
      const arr = map.get(status) ?? []
      arr.push(c); map.set(status, arr)
    })
    return map
  }, [candidates])

  async function updateStatus(c: Candidate, newStatus: CandStatus) {
    if (c.status === newStatus) return
    const prev = c.status
    setMovingId(c.id)
    // Otimista
    setCandidates(list => list.map(x => x.id === c.id ? { ...x, status: newStatus } : x))
    try {
      await api.patch(`/candidates/${c.id}/status`, { status: newStatus })
      toast.success(`${c.name} → ${labelFor(newStatus)}`)
    } catch {
      // rollback
      setCandidates(list => list.map(x => x.id === c.id ? { ...x, status: prev } : x))
      toast.error('Erro ao mover candidato')
    } finally {
      setMovingId(null)
    }
  }

  function onDragStart(e: React.DragEvent, c: Candidate) {
    e.dataTransfer.setData('text/plain', String(c.id))
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragOver(e: React.DragEvent, status: CandStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== status) setDragOverCol(status)
  }
  function onDragLeave() { setDragOverCol(null) }
  function onDrop(e: React.DragEvent, status: CandStatus) {
    e.preventDefault()
    setDragOverCol(null)
    const id = Number(e.dataTransfer.getData('text/plain'))
    const c = candidates.find(x => x.id === id)
    if (c) updateStatus(c, status)
  }

  return (
    <AppLayout title="Candidatos">
      <div className="space-y-3">
        {/* Header */}
        <div className="ds-card ds-card-pad">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <UsersIcon size={16} style={{ color: 'var(--primary)' }} />
              <h2 style={{ fontSize: 14, margin: 0, fontWeight: 600, color: 'var(--text)' }}>
                Pipeline de Candidatos
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                {candidates.length} no total
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Apenas <strong style={{ color: 'var(--success)' }}>Aprovado</strong> aparece nas recomendações
              </span>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                style={{
                  fontSize: 11, padding: '5px 10px', borderRadius: 4,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
              >
                <RefreshCw size={11} /> Atualizar
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="ds-card ds-card-pad">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
          </div>
        )}

        {/* Kanban */}
        {!loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, minmax(220px, 1fr))',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 8,
          }}>
            {COLUMNS.map(col => {
              const items = byStatus.get(col.status) ?? []
              const isDragTarget = dragOverCol === col.status
              return (
                <div
                  key={col.status}
                  onDragOver={(e) => onDragOver(e, col.status)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, col.status)}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid',
                    borderColor: isDragTarget ? 'var(--primary)' : 'var(--border)',
                    borderRadius: 8,
                    padding: 10,
                    minHeight: 200,
                    transition: 'border-color 100ms',
                  }}
                >
                  <div className="flex items-center justify-between mb-2 pb-2"
                       style={{ borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: col.color,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>
                      {col.label}
                    </span>
                    <span style={{
                      fontSize: 11, color: 'var(--text-muted)',
                      background: col.bg, padding: '1px 8px', borderRadius: 999, fontWeight: 600,
                    }}>
                      {items.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map(c => (
                      <CandidateCard
                        key={c.id}
                        c={c}
                        moving={movingId === c.id}
                        onDragStart={onDragStart}
                        onApprove={() => updateStatus(c, 'approved')}
                        onReject={() => updateStatus(c, 'rejected')}
                      />
                    ))}
                    {items.length === 0 && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                        — vazio —
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function CandidateCard({
  c, moving, onDragStart, onApprove, onReject,
}: {
  c: Candidate
  moving: boolean
  onDragStart: (e: React.DragEvent, c: Candidate) => void
  onApprove: () => void
  onReject: () => void
}) {
  const availPct = Math.round(c.availability * 100)
  const scorePct = c.score_initial != null ? Math.round(c.score_initial * 100) : null
  const isApproved = c.status === 'approved'
  const isRejected = c.status === 'rejected'
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, c)}
      style={{
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
        padding: 8, cursor: 'grab', opacity: moving ? 0.5 : 1,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <Link
          href={`/perfil-skills/${c.id}`}
          style={{
            fontSize: 12, color: 'var(--text)', fontWeight: 600,
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
            wordBreak: 'break-word', flex: 1,
          }}
          title="Ver perfil completo"
        >
          {c.name}
          <ExternalLink size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </Link>
        {scorePct !== null && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text)',
            padding: '1px 6px', borderRadius: 3,
            background: scorePct >= 90 ? 'var(--success-bg)' : scorePct >= 70 ? 'var(--warning-bg)' : 'var(--danger-bg)',
          }}>
            {scorePct}%
          </span>
        )}
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
        {c.city && c.state ? `${c.city}/${c.state}` : c.city || c.state || ''}
        {c.work_model && <span style={{ marginLeft: 6 }}>· {c.work_model}</span>}
        {availPct > 0 && <span style={{ marginLeft: 6 }}>· {availPct}% disp</span>}
      </div>

      {c.top_skills.length > 0 && (
        <div className="flex flex-wrap gap-1" style={{ marginTop: 4 }}>
          {c.top_skills.map((s, i) => (
            <span key={i} style={{
              fontSize: 9, color: 'var(--text-muted)',
              background: 'var(--surface-hover, transparent)',
              border: '1px solid var(--border)', borderRadius: 3,
              padding: '1px 5px', fontWeight: 500,
            }} title={s.level}>
              {s.name}
            </span>
          ))}
        </div>
      )}

      {/* Quick actions: aprovar/rejeitar visíveis se ainda não nesse estado */}
      {!isApproved && !isRejected && (
        <div className="flex items-center gap-1" style={{ marginTop: 6 }}>
          <button
            type="button"
            onClick={onApprove}
            style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 3,
              background: 'var(--success-bg)', border: '1px solid var(--success-border)',
              color: 'var(--success)', fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}
          >
            <Check size={9} /> Aprovar
          </button>
          <button
            type="button"
            onClick={onReject}
            style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 3,
              background: 'transparent', border: '1px solid var(--danger-border)',
              color: 'var(--danger)', fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}
          >
            <X size={9} /> Rejeitar
          </button>
        </div>
      )}
    </div>
  )
}

function labelFor(s: CandStatus): string {
  const c = COLUMNS.find(x => x.status === s)
  return c?.label ?? s
}
