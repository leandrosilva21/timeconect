'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { X, ExternalLink, Layers } from 'lucide-react'
import { useProjectStages } from '@/hooks/use-project-stages'
import { computeStageHealth } from '@/lib/utils/stage-health'
import { HealthDots } from './health-dots'

interface Props {
  projectId: number
  projectName: string
  customerName?: string | null
  onClose: () => void
}

function n(v: unknown): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

export function ProjectStagesSidePanel({
  projectId, projectName, customerName, onClose,
}: Props) {
  const { stages, loading, error } = useProjectStages(projectId)

  // Esc fecha
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)', zIndex: 60,
        }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(480px, 100vw)',
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.2)',
          zIndex: 70,
          display: 'flex', flexDirection: 'column',
          animation: 'slideInPanel .18s ease',
        }}
      >
        <style>{`@keyframes slideInPanel { from { transform: translateX(20px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>

        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {customerName && (
              <div style={{
                fontSize: 11, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '.04em',
              }}>
                {customerName}
              </div>
            )}
            <div style={{
              fontSize: 15, fontWeight: 600, color: 'var(--text)',
              marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {projectName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Action: abrir workspace cheio */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
          <Link
            href={`/projetos/${projectId}/etapas?from=pipeline`}
            className="ds-btn-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, padding: '8px 14px', textDecoration: 'none',
            }}
          >
            <ExternalLink size={13} /> Abrir tela cheia
          </Link>
        </div>

        {/* Content: lista compacta de etapas */}
        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10,
          }}>
            <Layers size={11} /> Etapas <span style={{ opacity: .6 }}>· {stages.length}</span>
          </div>

          {loading && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando…</div>
          )}
          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>
          )}

          {!loading && !error && stages.length === 0 && (
            <div style={{
              padding: '24px 16px', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: 13,
              border: '1px dashed var(--border)', borderRadius: 8,
            }}>
              Nenhuma etapa cadastrada ainda. Clique em <strong>Abrir tela cheia</strong> pra criar.
            </div>
          )}

          {!loading && stages.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stages.map(stage => {
                const health = computeStageHealth({ stage })
                const planned = n(stage.hours_planned)
                const total = stage.deliveries_count ?? 0
                const done = stage.deliveries_done_count ?? 0
                const pct = total > 0 ? Math.round((done / total) * 100) : 0

                return (
                  <li
                    key={stage.id}
                    className="ds-card ds-card-pad"
                    style={{ padding: 12 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 500, color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {stage.name}
                        </div>
                        {stage.responsible?.name && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {stage.responsible.name}
                          </div>
                        )}
                      </div>
                      <HealthDots health={health} />
                    </div>
                    {total > 0 && (
                      <>
                        <div style={{
                          marginTop: 10, height: 3, width: '100%',
                          background: 'var(--surface-hover)', borderRadius: 2, overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', width: `${Math.min(100, pct)}%`,
                            background: 'var(--primary)', transition: 'width .2s ease',
                          }} />
                        </div>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          marginTop: 4, fontSize: 11, color: 'var(--text-muted)',
                        }}>
                          <span>{done}/{total} entregas</span>
                          <span>{pct}%</span>
                        </div>
                      </>
                    )}
                    {planned > 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-light)' }}>
                        {planned}h previstas
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}
