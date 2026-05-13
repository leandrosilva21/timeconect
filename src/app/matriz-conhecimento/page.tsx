'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Star, Users as UsersIcon, Save, AlertTriangle } from 'lucide-react'

// ── Tipos locais (mantemos aqui pra não acoplar types globais ainda) ─────────
interface Skill {
  id: number
  name: string
  category: string
  parent_id: number | null
  type: 'module' | 'technology' | 'process'
}
interface SkillLevel {
  id: number
  name: string
  weight: number
}
interface ConsultantSkill {
  id: number
  consultant_id: number
  skill_id: number
  level_id: number
  years_experience: number | null
  last_used_at: string | null
  source: 'forms_import' | 'user_input' | 'validated'
  confidence: 'low' | 'medium' | 'high'
  notes: string | null
}
interface ConsultantOption {
  id: number
  name: string
}
interface Gap {
  skill: { id: number; name: string; category: string }
  context: string | null
  required_level: { id: number; name: string; weight: number }
  actual_level: { id: number; name: string; weight: number } | null
  type: 'missing' | 'below'
}
interface GapsResponse {
  consultant_id: number
  total: number
  gaps: Gap[]
}

export default function MatrizConhecimentoPage() {
  const [consultants, setConsultants]               = useState<ConsultantOption[]>([])
  const [skills, setSkills]                         = useState<Skill[]>([])
  const [levels, setLevels]                         = useState<SkillLevel[]>([])
  const [selectedConsultant, setSelectedConsultant] = useState<number | null>(null)
  const [consultantSkills, setConsultantSkills]     = useState<ConsultantSkill[]>([])
  const [loadingMeta, setLoadingMeta]               = useState(true)
  const [loadingSkills, setLoadingSkills]           = useState(false)
  const [savingSkillId, setSavingSkillId]           = useState<number | null>(null)
  const [gaps, setGaps]                             = useState<Gap[]>([])
  const [loadingGaps, setLoadingGaps]               = useState(false)

  // ── Carrega skills + levels + lista de consultores ──────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingMeta(true)
      try {
        const [meta, users] = await Promise.all([
          api.get<{ skills: Skill[]; levels: SkillLevel[] }>('/skills'),
          api.get<{ items?: ConsultantOption[]; data?: ConsultantOption[] }>('/users?pageSize=500'),
        ])
        setSkills(meta.skills ?? [])
        setLevels(meta.levels ?? [])
        const rawUsers: any[] = Array.isArray((users as any)?.items)
          ? (users as any).items
          : Array.isArray((users as any)?.data)
          ? (users as any).data
          : []
        // Filtra só consultores (type === 'consultor' OU consultant_type setado)
        const filtered = rawUsers
          .filter(u => u?.type === 'consultor' || u?.consultant_type)
          .map(u => ({ id: u.id, name: u.name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        setConsultants(filtered)
      } catch (err) {
        toast.error('Erro ao carregar dados iniciais')
      } finally {
        setLoadingMeta(false)
      }
    })()
  }, [])

  // ── Carrega skills do consultor selecionado ────────────────────────────────
  const loadConsultantSkills = useCallback(async (consultantId: number) => {
    setLoadingSkills(true)
    setLoadingGaps(true)
    try {
      const [data, gapsData] = await Promise.all([
        api.get<ConsultantSkill[]>(`/consultants/${consultantId}/skills`),
        api.get<GapsResponse>(`/consultants/${consultantId}/gaps`).catch(() => null),
      ])
      setConsultantSkills(Array.isArray(data) ? data : [])
      setGaps(gapsData?.gaps ?? [])
    } catch {
      toast.error('Erro ao carregar skills do consultor')
      setConsultantSkills([])
      setGaps([])
    } finally {
      setLoadingSkills(false)
      setLoadingGaps(false)
    }
  }, [])

  useEffect(() => {
    if (selectedConsultant != null) {
      loadConsultantSkills(selectedConsultant)
    } else {
      setConsultantSkills([])
      setGaps([])
    }
  }, [selectedConsultant, loadConsultantSkills])

  // ── Mapa skill_id → consultant_skill pra lookup rápido ──────────────────────
  const csBySkill = useMemo(() => {
    const m = new Map<number, ConsultantSkill>()
    consultantSkills.forEach(cs => m.set(cs.skill_id, cs))
    return m
  }, [consultantSkills])

  // ── Skills agrupadas por categoria ──────────────────────────────────────────
  const skillsByCategory = useMemo(() => {
    const groups = new Map<string, Skill[]>()
    skills.forEach(s => {
      const arr = groups.get(s.category) ?? []
      arr.push(s)
      groups.set(s.category, arr)
    })
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([cat, arr]) => [cat, arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))] as const)
  }, [skills])

  // ── Edita nível inline (salva automaticamente) ──────────────────────────────
  async function handleLevelChange(skill: Skill, newLevelId: number | '') {
    if (!selectedConsultant) return
    if (newLevelId === '') {
      // Limpar nível: por simplicidade, não excluímos — pulamos
      // (delete não está no spec; sobrescrever nível é a única operação suportada)
      return
    }
    setSavingSkillId(skill.id)
    try {
      const saved = await api.post<ConsultantSkill>(
        `/consultants/${selectedConsultant}/skills`,
        { skill_id: skill.id, level_id: newLevelId, source: 'user_input', confidence: 'medium' }
      )
      // Atualiza otimista do state — sem refetch (eventual consistency segura aqui pois é uma só linha)
      setConsultantSkills(prev => {
        const idx = prev.findIndex(cs => cs.skill_id === skill.id)
        if (idx >= 0) {
          const next = prev.slice()
          next[idx] = { ...next[idx], ...saved }
          return next
        }
        return [...prev, saved]
      })
      toast.success(`Nível salvo: ${skill.name}`)
    } catch {
      toast.error(`Erro ao salvar ${skill.name}`)
    } finally {
      setSavingSkillId(null)
    }
  }

  return (
    <AppLayout title="Matriz de Conhecimento">
      <div className="space-y-4">

        {/* ── Seletor de consultor ──────────────────────────────────────────── */}
        <div className="ds-card ds-card-pad">
          <div className="flex items-center gap-3 mb-3">
            <UsersIcon size={18} style={{ color: 'var(--text-muted)' }} />
            <h2 className="ds-card-title" style={{ fontSize: 14, margin: 0 }}>Consultor</h2>
          </div>
          <select
            className="ds-input w-full"
            value={selectedConsultant ?? ''}
            onChange={(e) => setSelectedConsultant(e.target.value ? Number(e.target.value) : null)}
            disabled={loadingMeta}
          >
            <option value="">— Selecione um consultor —</option>
            {consultants.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {loadingMeta && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Carregando consultores…</p>
          )}
        </div>

        {/* ── Gaps críticos ──────────────────────────────────────────────── */}
        {selectedConsultant && !loadingGaps && gaps.length > 0 && (
          <div className="ds-card ds-card-pad ds-card-highlight-danger">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} style={{ color: 'var(--danger-border, var(--text))' }} />
              <h3 className="ds-card-title" style={{ fontSize: 13, margin: 0 }}>Gaps críticos</h3>
              <span className="ds-card-sub" style={{ marginLeft: 8 }}>{gaps.length} skill{gaps.length === 1 ? '' : 's'} abaixo do requerido</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {gaps.map((g, i) => (
                <div
                  key={`${g.skill.id}-${g.context ?? ''}-${i}`}
                  className="flex items-center justify-between gap-4 py-2"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{g.skill.name}</span>
                    <span className="ds-card-sub" style={{ fontSize: 11 }}>{g.skill.category}</span>
                    {g.context && (
                      <span className="ds-status ds-status-info" style={{ fontSize: 10 }}>{g.context}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    {g.type === 'missing' ? (
                      <span className="ds-status ds-status-danger">não possui</span>
                    ) : (
                      <span className="ds-status ds-status-warning">{g.actual_level?.name}</span>
                    )}
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <span className="ds-status ds-status-info">{g.required_level.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedConsultant && !loadingGaps && gaps.length === 0 && (
          <div className="ds-card ds-card-pad ds-card-highlight-success">
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              ✓ Sem gaps críticos.
            </p>
          </div>
        )}

        {/* ── Skills agrupadas ──────────────────────────────────────────────── */}
        {selectedConsultant && (
          <>
            {loadingSkills && (
              <div className="ds-card ds-card-pad">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando skills…</p>
              </div>
            )}

            {!loadingSkills && skills.length === 0 && (
              <div className="ds-card ds-card-pad">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Nenhuma skill cadastrada ainda. Skills serão importadas posteriormente.
                </p>
              </div>
            )}

            {!loadingSkills && skillsByCategory.map(([category, items]) => (
              <div key={category} className="ds-card ds-card-pad">
                <div className="ds-card-header" style={{ paddingBottom: 8 }}>
                  <div className="flex items-center gap-2">
                    <Star size={14} style={{ color: 'var(--primary)' }} />
                    <h3 className="ds-card-title" style={{ fontSize: 13, margin: 0 }}>{category}</h3>
                    <span className="ds-card-sub" style={{ marginLeft: 8 }}>{items.length} skill{items.length === 1 ? '' : 's'}</span>
                  </div>
                </div>

                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {items.map(skill => {
                    const cs = csBySkill.get(skill.id)
                    const currentLevelId = cs?.level_id ?? ''
                    const saving = savingSkillId === skill.id
                    return (
                      <div
                        key={skill.id}
                        className="flex items-center justify-between gap-4 py-2.5"
                        style={{ borderTop: '1px solid var(--border)' }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{skill.name}</span>
                          {cs?.source === 'forms_import' && (
                            <span className="ds-status ds-status-info" style={{ fontSize: 10 }}>forms</span>
                          )}
                          {cs?.source === 'validated' && (
                            <span className="ds-status ds-status-success" style={{ fontSize: 10 }}>validado</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {saving && <Save size={12} className="animate-pulse" style={{ color: 'var(--text-muted)' }} />}
                          <select
                            className="ds-input"
                            style={{ minWidth: 160 }}
                            value={currentLevelId}
                            onChange={(e) => handleLevelChange(skill, e.target.value ? Number(e.target.value) : '')}
                            disabled={saving}
                          >
                            <option value="">— sem nível —</option>
                            {levels.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {!selectedConsultant && !loadingMeta && (
          <div className="ds-card ds-card-pad">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Selecione um consultor acima para editar suas skills.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
