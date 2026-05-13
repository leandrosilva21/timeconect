'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Check, User as UserIcon, Clock,
  Star, Layers, Briefcase, Save,
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface ProfileResponse {
  id: number
  name: string
  email: string
  type: string | null
  consultant_type: 'internal' | 'candidate' | null
  availability_status: 'integral' | 'parcial' | 'indisponivel' | null
  hours_available: number | null
  capacity_hours: number | null
  allocated_hours: number | null
  availability_start_date: string | null
  relevant_projects: string | null
  segments: string[] | null
}
interface Skill {
  id: number
  name: string
  category: string
  parent_id: number | null
  type: 'module' | 'technology' | 'process'
}
interface SkillLevel { id: number; name: string; weight: number }
interface ConsultantSkill {
  id: number
  consultant_id: number
  skill_id: number
  level_id: number
  years_experience: number | null
  source: 'forms_import' | 'user_input' | 'validated'
  confidence: 'low' | 'medium' | 'high'
  atuacao_types: string[] | null
}

const STEPS = [
  { id: 1, label: 'Identificação',  icon: UserIcon },
  { id: 2, label: 'Disponibilidade', icon: Clock },
  { id: 3, label: 'Skills',          icon: Star },
  { id: 4, label: 'Tecnologias',    icon: Layers },
  { id: 5, label: 'Experiência',    icon: Briefcase },
] as const
type StepId = typeof STEPS[number]['id']

const AVAIL_OPTIONS: Array<{value:'integral'|'parcial'|'indisponivel', label:string}> = [
  { value: 'integral',     label: 'Integral (full-time)' },
  { value: 'parcial',      label: 'Parcial (part-time)' },
  { value: 'indisponivel', label: 'Indisponível no momento' },
]
const ATUACAO_TYPES = ['Implementação', 'Suporte', 'Manutenção', 'Desenvolvimento', 'Consultoria'] as const
const SEGMENTS = ['Indústria', 'Serviços', 'Varejo', 'Saúde', 'Educação', 'Financeiro', 'Pública', 'Agronegócio', 'Outros'] as const

// Step 3 vs Step 4: filtragem por categoria de skill
const SKILLS_CATEGORIES = ['Protheus', 'App TOTVS']
const TECH_CATEGORIES   = ['Banco de Dados', 'Linguagem', 'Frontend', 'Backend', 'Infra', 'Ferramentas', 'Geral']

// ── Página ───────────────────────────────────────────────────────────────────
export default function PerfilSkillsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const consultantId = Number(params.id)

  const [step, setStep]           = useState<StepId>(1)
  const [profile, setProfile]     = useState<ProfileResponse | null>(null)
  const [skills, setSkills]       = useState<Skill[]>([])
  const [levels, setLevels]       = useState<SkillLevel[]>([])
  const [cs, setCs]               = useState<ConsultantSkill[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  // Form state (mirrors profile + cs)
  const [form, setForm] = useState({
    name: '', email: '',
    availability_status: '' as '' | 'integral' | 'parcial' | 'indisponivel',
    hours_available: '' as string,
    availability_start_date: '',
    relevant_projects: '',
    segments: [] as string[],
  })

  // Per-skill edits map (skill_id → patch)
  const [skillEdits, setSkillEdits] = useState<Record<number, {
    level_id?: number | null
    years_experience?: number | null
    atuacao_types?: string[]
  }>>({})

  // ── Carregar tudo ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!consultantId) return
    setLoading(true)
    ;(async () => {
      try {
        const [pf, meta, csData] = await Promise.all([
          api.get<ProfileResponse>(`/consultants/${consultantId}/profile`),
          api.get<{ skills: Skill[]; levels: SkillLevel[] }>('/skills'),
          api.get<ConsultantSkill[]>(`/consultants/${consultantId}/skills`),
        ])
        setProfile(pf)
        setSkills(meta.skills ?? [])
        setLevels(meta.levels ?? [])
        setCs(csData ?? [])
        // Hidrata form
        setForm({
          name: pf.name ?? '',
          email: pf.email ?? '',
          availability_status: (pf.availability_status ?? '') as any,
          hours_available: pf.hours_available != null ? String(pf.hours_available) : '',
          availability_start_date: pf.availability_start_date ?? '',
          relevant_projects: pf.relevant_projects ?? '',
          segments: pf.segments ?? [],
        })
        // Hidrata edits a partir do que já existe
        const edits: typeof skillEdits = {}
        ;(csData ?? []).forEach(c => {
          edits[c.skill_id] = {
            level_id: c.level_id,
            years_experience: c.years_experience,
            atuacao_types: c.atuacao_types ?? [],
          }
        })
        setSkillEdits(edits)
      } catch {
        toast.error('Erro ao carregar perfil')
      } finally {
        setLoading(false)
      }
    })()
  }, [consultantId])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const skillsByCat = useMemo(() => {
    const groups = new Map<string, Skill[]>()
    skills.forEach(s => {
      const arr = groups.get(s.category) ?? []
      arr.push(s); groups.set(s.category, arr)
    })
    return Array.from(groups.entries())
      .map(([cat, arr]) => [cat, arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))] as const)
  }, [skills])

  const progress = useMemo(() => {
    // Heurística de % preenchido — não exige tudo, mas dá feedback
    let filled = 0, total = 5
    if (form.name && form.email) filled++
    if (form.availability_status) filled++
    // Step 3: pelo menos 1 skill protheus com nível
    const hasSkill = Object.entries(skillEdits).some(([sid, e]) => {
      const sk = skills.find(s => s.id === Number(sid))
      return sk && SKILLS_CATEGORIES.includes(sk.category) && e.level_id
    })
    if (hasSkill) filled++
    // Step 4: pelo menos 1 tecnologia
    const hasTech = Object.entries(skillEdits).some(([sid, e]) => {
      const sk = skills.find(s => s.id === Number(sid))
      return sk && TECH_CATEGORIES.includes(sk.category) && e.level_id
    })
    if (hasTech) filled++
    if (form.relevant_projects || form.segments.length > 0) filled++
    return Math.round((filled / total) * 100)
  }, [form, skillEdits, skills])

  // ── Salvamento por step ────────────────────────────────────────────────────
  const saveProfile = useCallback(async () => {
    setSaving(true)
    try {
      const payload: any = {}
      if (form.name)                    payload.name = form.name
      if (form.email)                   payload.email = form.email
      if (form.availability_status)     payload.availability_status = form.availability_status
      if (form.availability_start_date) payload.availability_start_date = form.availability_start_date
      if (form.relevant_projects)       payload.relevant_projects = form.relevant_projects
      if (form.segments.length)         payload.segments = form.segments
      const hours = parseInt(form.hours_available, 10)
      if (!isNaN(hours) && form.availability_status !== 'indisponivel') {
        payload.hours_available = hours
      }
      await api.patch(`/consultants/${consultantId}/profile`, payload)
    } catch (e) {
      toast.error('Erro ao salvar perfil')
      throw e
    } finally {
      setSaving(false)
    }
  }, [form, consultantId])

  const saveSkillsForCategories = useCallback(async (categories: string[]) => {
    const items = Object.entries(skillEdits)
      .filter(([sid, e]) => {
        if (!e.level_id) return false
        const sk = skills.find(s => s.id === Number(sid))
        return sk && categories.includes(sk.category)
      })
      .map(([sid, e]) => ({
        skill_id: Number(sid),
        level_id: e.level_id!,
        years_experience: e.years_experience ?? null,
        atuacao_types: e.atuacao_types && e.atuacao_types.length ? e.atuacao_types : null,
        source: 'user_input',
        confidence: 'high', // usuário confirmou via form
      }))
    if (items.length === 0) return
    setSaving(true)
    try {
      await api.post(`/consultants/${consultantId}/skills`, { items })
    } catch {
      toast.error('Erro ao salvar skills do passo')
      throw new Error('skills-save-failed')
    } finally {
      setSaving(false)
    }
  }, [skillEdits, skills, consultantId])

  const next = useCallback(async () => {
    try {
      if (step === 1 || step === 2 || step === 5) await saveProfile()
      if (step === 3) await saveSkillsForCategories(SKILLS_CATEGORIES)
      if (step === 4) await saveSkillsForCategories(TECH_CATEGORIES)
      toast.success(`Passo ${step} salvo`)
      if (step < 5) setStep((step + 1) as StepId)
    } catch { /* já mostrou toast de erro */ }
  }, [step, saveProfile, saveSkillsForCategories])

  const finish = useCallback(async () => {
    try {
      if (step === 5) await saveProfile()
      toast.success('Perfil salvo')
      router.push('/matriz-conhecimento')
    } catch {}
  }, [step, saveProfile, router])

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout title="Perfil de Skills">
        <div className="ds-card ds-card-pad">
          <p style={{ color: 'var(--text-muted)' }}>Carregando perfil…</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Perfil de Skills">
      <div className="space-y-4">

        {/* Header: progresso + steps */}
        <div className="ds-card ds-card-pad">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <h2 style={{ fontSize: 14, margin: 0, fontWeight: 600, color: 'var(--text)' }}>
                {profile?.name}
              </h2>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {profile?.email} · {profile?.consultant_type === 'candidate' ? 'Candidato'
                  : profile?.type === 'parceiro_admin' ? 'Parceiro' : 'Interno'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Preenchido: <strong style={{ color: 'var(--text)' }}>{progress}%</strong>
              </span>
              <Link
                href="/matriz-conhecimento"
                style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'underline' }}
              >
                Voltar
              </Link>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ background: 'var(--border)', height: 6, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'var(--primary)', transition: 'width 200ms ease',
            }} />
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1.5 mt-4 flex-wrap">
            {STEPS.map(s => {
              const active = step === s.id
              const done = step > s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className="flex items-center gap-1.5"
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 4,
                    border: '1px solid',
                    background: active ? 'var(--primary-soft)' : 'transparent',
                    borderColor: active ? 'var(--primary)' : done ? 'var(--success-border)' : 'var(--border)',
                    color: active ? 'var(--primary)' : done ? 'var(--success)' : 'var(--text-muted)',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {done ? <Check size={11} /> : <s.icon size={11} />}
                  {s.id}. {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Conteúdo do step */}
        {step === 1 && (
          <Step1Identificacao
            form={form} setForm={setForm} profile={profile}
          />
        )}
        {step === 2 && (
          <Step2Disponibilidade form={form} setForm={setForm} />
        )}
        {(step === 3 || step === 4) && (
          <StepSkills
            categories={step === 3 ? SKILLS_CATEGORIES : TECH_CATEGORIES}
            title={step === 3 ? 'Skills (Protheus / Apps TOTVS)' : 'Tecnologias'}
            skillsByCat={skillsByCat}
            levels={levels}
            cs={cs}
            edits={skillEdits}
            setEdits={setSkillEdits}
          />
        )}
        {step === 5 && (
          <Step5Experiencia form={form} setForm={setForm} />
        )}

        {/* Footer com navegação */}
        <div className="ds-card ds-card-pad flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            disabled={step === 1 || saving}
            onClick={() => setStep(((step - 1) || 1) as StepId)}
            style={{
              fontSize: 12, padding: '8px 14px', borderRadius: 4,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: step === 1 ? 'var(--text-muted)' : 'var(--text)',
              fontWeight: 500,
              cursor: step === 1 || saving ? 'not-allowed' : 'pointer',
              opacity: step === 1 || saving ? 0.5 : 1,
            }}
          >
            <ArrowLeft size={12} /> Anterior
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={finish}
              style={{
                fontSize: 12, padding: '8px 14px', borderRadius: 4,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text)', fontWeight: 500, cursor: saving ? 'wait' : 'pointer',
              }}
            >
              <Save size={12} /> Salvar e sair
            </button>
            {step < 5 ? (
              <button
                type="button"
                className="ds-btn-primary"
                disabled={saving}
                onClick={next}
                style={{ fontSize: 12, padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {saving ? 'Salvando…' : 'Próximo'} <ArrowRight size={12} />
              </button>
            ) : (
              <button
                type="button"
                className="ds-btn-primary"
                disabled={saving}
                onClick={finish}
                style={{ fontSize: 12, padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Check size={12} /> Concluir
              </button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

// ── Step 1 — Identificação ────────────────────────────────────────────────────
function Step1Identificacao({
  form, setForm, profile,
}: {
  form: any
  setForm: (f: any) => void
  profile: ProfileResponse | null
}) {
  return (
    <div className="ds-card ds-card-pad">
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
        Identificação
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Confirme nome, email e seu tipo no sistema.
      </p>
      <div className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
            Nome completo
          </label>
          <input
            className="ds-input w-full"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
            E-mail
          </label>
          <input
            className="ds-input w-full"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@dominio.com"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
            Tipo (apenas leitura)
          </label>
          <p style={{
            fontSize: 12, padding: '8px 12px',
            background: 'var(--surface-hover, transparent)',
            border: '1px dashed var(--border)', borderRadius: 4,
            color: 'var(--text)',
          }}>
            {profile?.consultant_type === 'candidate' ? 'Candidato'
              : profile?.type === 'parceiro_admin' ? 'Parceiro'
              : 'Interno'}
            <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
              · alterar via gestão de usuários
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Step 2 — Disponibilidade ──────────────────────────────────────────────────
function Step2Disponibilidade({ form, setForm }: { form: any; setForm: (f:any)=>void }) {
  const disabled = form.availability_status === 'indisponivel'
  return (
    <div className="ds-card ds-card-pad">
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
        Disponibilidade
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Indique sua disponibilidade atual — base pro cálculo de alocação.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
            Status
          </label>
          <div className="flex gap-2 flex-wrap">
            {AVAIL_OPTIONS.map(opt => {
              const active = form.availability_status === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, availability_status: opt.value })}
                  style={{
                    fontSize: 12, padding: '8px 14px', borderRadius: 4,
                    background: active ? 'var(--primary-soft)' : 'transparent',
                    border: '1px solid',
                    borderColor: active ? 'var(--primary)' : 'var(--border)',
                    color: active ? 'var(--primary)' : 'var(--text)',
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
            Horas disponíveis no mês {disabled && <span style={{ color: 'var(--text-light)' }}>(desabilitado se indisponível)</span>}
          </label>
          <input
            className="ds-input"
            type="number"
            min={0} max={240}
            disabled={disabled}
            value={form.hours_available}
            onChange={(e) => setForm({ ...form, hours_available: e.target.value })}
            placeholder="ex: 160"
            style={{ width: 160 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
            Data de início
          </label>
          <input
            className="ds-input"
            type="date"
            value={form.availability_start_date}
            onChange={(e) => setForm({ ...form, availability_start_date: e.target.value })}
            style={{ width: 200 }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Step Skills (3 e 4 compartilham este componente) ──────────────────────────
function StepSkills({
  categories, title, skillsByCat, levels, cs, edits, setEdits,
}: {
  categories: string[]
  title: string
  skillsByCat: readonly (readonly [string, Skill[]])[]
  levels: SkillLevel[]
  cs: ConsultantSkill[]
  edits: Record<number, any>
  setEdits: React.Dispatch<React.SetStateAction<Record<number, any>>>
}) {
  const filteredGroups = skillsByCat.filter(([cat]) => categories.includes(cat))
  const csBySkill = useMemo(() => {
    const m = new Map<number, ConsultantSkill>()
    cs.forEach(c => m.set(c.skill_id, c))
    return m
  }, [cs])

  if (filteredGroups.length === 0) {
    return (
      <div className="ds-card ds-card-pad">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Sem skills cadastradas nesta categoria ainda.
        </p>
      </div>
    )
  }

  function updateSkill(sid: number, patch: any) {
    setEdits(prev => ({ ...prev, [sid]: { ...(prev[sid] ?? {}), ...patch } }))
  }
  function toggleAtuacao(sid: number, t: string) {
    const cur = edits[sid]?.atuacao_types ?? []
    const next = cur.includes(t) ? cur.filter((x:string) => x !== t) : [...cur, t]
    updateSkill(sid, { atuacao_types: next })
  }

  return (
    <div className="ds-card ds-card-pad">
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
        {title}
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Para cada skill que você tem, indique nível e (opcional) anos de experiência e tipo de atuação.
        Skills em branco são ignoradas.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {filteredGroups.map(([cat, items]) => (
          <div key={cat}>
            <p style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8,
            }}>
              {cat}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(sk => {
                const e = edits[sk.id] ?? {}
                const existing = csBySkill.get(sk.id)
                const isFromForms = existing?.source === 'forms_import'
                return (
                  <div
                    key={sk.id}
                    style={{
                      padding: '8px 10px',
                      border: '1px solid var(--border)', borderRadius: 4,
                      background: e.level_id ? 'var(--surface-hover, transparent)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm" style={{ color: 'var(--text)', fontWeight: e.level_id ? 600 : 500 }}>
                          {sk.name}
                        </span>
                        {isFromForms && (
                          <span style={{
                            fontSize: 10, color: 'var(--text-muted)',
                            border: '1px dashed var(--border)', padding: '1px 6px',
                            borderRadius: 3, fontWeight: 500,
                          }}>
                            forms (revisar)
                          </span>
                        )}
                      </div>
                      <select
                        className="ds-input"
                        value={e.level_id ?? ''}
                        onChange={(ev) => updateSkill(sk.id, { level_id: ev.target.value ? Number(ev.target.value) : null })}
                        style={{ minWidth: 150 }}
                      >
                        <option value="">— sem nível —</option>
                        {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>

                    {e.level_id && (
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Anos:</span>
                          <input
                            className="ds-input"
                            type="number" min={0} max={50}
                            value={e.years_experience ?? ''}
                            onChange={(ev) => updateSkill(sk.id, {
                              years_experience: ev.target.value ? Number(ev.target.value) : null,
                            })}
                            placeholder="—"
                            style={{ width: 70, fontSize: 11, padding: '3px 6px' }}
                          />
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Atuação:</span>
                          {ATUACAO_TYPES.map(t => {
                            const on = (e.atuacao_types ?? []).includes(t)
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => toggleAtuacao(sk.id, t)}
                                style={{
                                  fontSize: 10, padding: '2px 8px', borderRadius: 3,
                                  background: on ? 'var(--primary-soft)' : 'transparent',
                                  border: '1px solid',
                                  borderColor: on ? 'var(--primary)' : 'var(--border)',
                                  color: on ? 'var(--primary)' : 'var(--text-muted)',
                                  fontWeight: on ? 600 : 500, cursor: 'pointer',
                                }}
                              >
                                {t}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step 5 — Experiência ──────────────────────────────────────────────────────
function Step5Experiencia({ form, setForm }: { form: any; setForm: (f:any)=>void }) {
  function toggleSegment(s: string) {
    const cur: string[] = form.segments ?? []
    const next = cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]
    setForm({ ...form, segments: next })
  }
  return (
    <div className="ds-card ds-card-pad">
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
        Experiência
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Projetos relevantes e segmentos em que atuou.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
            Projetos relevantes
          </label>
          <textarea
            className="ds-input w-full"
            rows={4}
            value={form.relevant_projects}
            onChange={(e) => setForm({ ...form, relevant_projects: e.target.value })}
            placeholder="Liste 2-3 projetos onde atuou (cliente, módulo, papel, duração)…"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
            Segmentos atuados
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SEGMENTS.map(s => {
              const on = (form.segments ?? []).includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSegment(s)}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 3,
                    background: on ? 'var(--primary-soft)' : 'transparent',
                    border: '1px solid',
                    borderColor: on ? 'var(--primary)' : 'var(--border)',
                    color: on ? 'var(--primary)' : 'var(--text)',
                    fontWeight: on ? 600 : 500, cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
