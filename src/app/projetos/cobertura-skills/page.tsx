'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { UserCheck, FolderOpen, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface ProjectOption {
  id: number
  name: string
  code?: string
}

interface CoverageMissing {
  consultant_id: number
  name: string
  actual_level: string | null
  type: 'missing' | 'below'
}
interface CoverageCovering {
  consultant_id: number
  name: string
  level: string
}
interface RequiredSkillCoverage {
  skill: { id: number; name: string; category: string }
  required_level: { id: number; name: string; weight: number }
  consultants_total: number
  consultants_covering: number
  covering: CoverageCovering[]
  missing: CoverageMissing[]
}
interface CoverageResponse {
  project: { id: number; name: string; consultants_count: number }
  required_skills: RequiredSkillCoverage[]
}

export default function CoberturaSkillsPage() {
  const [projects, setProjects]                 = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects]   = useState(true)
  const [selectedProject, setSelectedProject]   = useState<number | null>(null)
  const [coverage, setCoverage]                 = useState<CoverageResponse | null>(null)
  const [loadingCoverage, setLoadingCoverage]   = useState(false)

  useEffect(() => {
    (async () => {
      setLoadingProjects(true)
      try {
        const r = await api.get<{ items?: ProjectOption[]; data?: ProjectOption[] }>('/projects?pageSize=500')
        const arr: any[] = Array.isArray((r as any)?.items)
          ? (r as any).items
          : Array.isArray((r as any)?.data)
          ? (r as any).data
          : []
        const opts = arr
          .map(p => ({ id: p.id, name: p.name, code: p.code }))
          .sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name, 'pt-BR'))
        setProjects(opts)
      } catch {
        toast.error('Erro ao carregar projetos')
      } finally {
        setLoadingProjects(false)
      }
    })()
  }, [])

  const loadCoverage = useCallback(async (projectId: number) => {
    setLoadingCoverage(true)
    try {
      const data = await api.get<CoverageResponse>(`/projects/${projectId}/gaps`)
      setCoverage(data)
    } catch {
      toast.error('Erro ao carregar cobertura')
      setCoverage(null)
    } finally {
      setLoadingCoverage(false)
    }
  }, [])

  useEffect(() => {
    if (selectedProject != null) loadCoverage(selectedProject)
    else setCoverage(null)
  }, [selectedProject, loadCoverage])

  const summary = useMemo(() => {
    if (!coverage) return null
    const total = coverage.required_skills.length
    if (total === 0) return null
    const fullyCovered = coverage.required_skills.filter(
      s => s.consultants_total > 0 && s.consultants_covering === s.consultants_total
    ).length
    const noCoverage = coverage.required_skills.filter(s => s.consultants_covering === 0).length
    return { total, fullyCovered, noCoverage }
  }, [coverage])

  return (
    <AppLayout title="Cobertura de Skills">
      <div className="space-y-4">

        {/* Seletor de projeto */}
        <div className="ds-card ds-card-pad">
          <div className="flex items-center gap-3 mb-3">
            <FolderOpen size={18} style={{ color: 'var(--text-muted)' }} />
            <h2 className="ds-card-title" style={{ fontSize: 14, margin: 0 }}>Projeto</h2>
          </div>
          <select
            className="ds-input w-full"
            value={selectedProject ?? ''}
            onChange={(e) => setSelectedProject(e.target.value ? Number(e.target.value) : null)}
            disabled={loadingProjects}
          >
            <option value="">— Selecione um projeto —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.code ? `${p.code} — ${p.name}` : p.name}
              </option>
            ))}
          </select>
          {loadingProjects && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Carregando projetos…</p>
          )}
        </div>

        {/* Conteúdo da cobertura */}
        {selectedProject && loadingCoverage && (
          <div className="ds-card ds-card-pad">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando cobertura…</p>
          </div>
        )}

        {selectedProject && !loadingCoverage && coverage && coverage.required_skills.length === 0 && (
          <div className="ds-card ds-card-pad">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Nenhuma skill exigida cadastrada para este projeto. Configure via{' '}
              <code style={{ background: 'var(--surface-hover)', padding: '1px 4px', borderRadius: 3 }}>
                POST /api/v1/projects/{coverage.project.id}/required-skills
              </code>.
            </p>
          </div>
        )}

        {summary && (
          <div className="ds-card ds-card-pad">
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Skills exigidas</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{summary.total}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>100% cobertas</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{summary.fullyCovered}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sem cobertura</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{summary.noCoverage}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Consultores alocados</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{coverage?.project.consultants_count}</p>
              </div>
            </div>
          </div>
        )}

        {coverage?.required_skills.map(rs => {
          const pct = rs.consultants_total > 0
            ? Math.round((rs.consultants_covering / rs.consultants_total) * 100)
            : 0
          const isFull = rs.consultants_total > 0 && rs.consultants_covering === rs.consultants_total
          const isNone = rs.consultants_covering === 0
          const highlightClass = isFull
            ? 'ds-card-highlight-success'
            : isNone
            ? 'ds-card-highlight-danger'
            : 'ds-card-highlight-warning'

          return (
            <div key={rs.skill.id} className={`ds-card ds-card-pad ${highlightClass}`}>
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isFull ? (
                    <CheckCircle2 size={14} style={{ color: 'var(--success-border, var(--text))' }} />
                  ) : (
                    <AlertTriangle size={14} style={{ color: 'var(--warning-border, var(--text))' }} />
                  )}
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{rs.skill.name}</span>
                  <span className="ds-card-sub" style={{ fontSize: 11 }}>{rs.skill.category}</span>
                </div>
                <div className="flex items-center gap-2 text-xs shrink-0">
                  <span className="ds-status ds-status-info">requer {rs.required_level.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {rs.consultants_covering}/{rs.consultants_total} ({pct}%)
                  </span>
                </div>
              </div>

              {rs.missing.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    Não cobrem ({rs.missing.length}):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rs.missing.map(m => (
                      <span
                        key={m.consultant_id}
                        className={`ds-status ${m.type === 'missing' ? 'ds-status-danger' : 'ds-status-warning'}`}
                        style={{ fontSize: 11 }}
                        title={m.type === 'missing' ? 'não possui' : `tem ${m.actual_level}`}
                      >
                        {m.name}{m.type === 'below' && m.actual_level ? ` (${m.actual_level})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {!selectedProject && !loadingProjects && (
          <div className="ds-card ds-card-pad">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Selecione um projeto acima para ver a cobertura de skills dos consultores alocados.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
