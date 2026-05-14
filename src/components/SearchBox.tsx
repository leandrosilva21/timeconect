'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, User as UserIcon, Star, FolderOpen } from 'lucide-react'
import { api } from '@/lib/api'

interface PersonResult {
  id: number
  name: string
  email: string
  type: string
  main_skill: string | null
  main_skill_level: string | null
  matched_by_skill: boolean
}
interface SkillResult { id: number; name: string; category: string }
interface ProjectResult { id: number; name: string; code: string }

interface SearchResponse {
  q: string
  people: PersonResult[]
  skills: SkillResult[]
  projects: ProjectResult[]
}

export function SearchBox() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.get<SearchResponse>(`/search?q=${encodeURIComponent(q.trim())}`)
        setResults(r)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q])

  // Close on outside click + Esc
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const total =
    (results?.people.length ?? 0) +
    (results?.skills.length ?? 0) +
    (results?.projects.length ?? 0)

  function go(path: string) {
    setOpen(false)
    setQ('')
    setResults(null)
    router.push(path)
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', width: 300 }}>
      <div style={{ position: 'relative' }}>
        <Search
          size={13}
          style={{
            position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }}
        />
        <input
          ref={inputRef}
          className="ds-input"
          style={{
            paddingLeft: 30, paddingRight: q ? 30 : 12,
            fontSize: 12, width: '100%', height: 32,
          }}
          placeholder="Buscar pessoas, skills, projetos"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ(''); setResults(null); inputRef.current?.focus()
            }}
            style={{
              position: 'absolute', right: 6, top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4,
              display: 'flex', alignItems: 'center',
            }}
            title="Limpar"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0, right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            maxHeight: 480,
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          {loading && (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>
              Buscando…
            </div>
          )}

          {!loading && results && total === 0 && (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>
              Nenhum resultado pra <strong>"{q}"</strong>
            </div>
          )}

          {!loading && results && results.people.length > 0 && (
            <Section title="Pessoas" count={results.people.length}>
              {results.people.map(p => (
                <button
                  key={`p-${p.id}`}
                  type="button"
                  onClick={() => go(`/perfil-skills/${p.id}`)}
                  style={rowStyle()}
                >
                  <UserIcon size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {p.type}
                      {p.main_skill && (
                        <> · <span style={{
                          color: p.matched_by_skill ? 'var(--primary)' : 'var(--text-muted)',
                          fontWeight: p.matched_by_skill ? 600 : 400,
                        }}>{p.main_skill}</span>
                        {p.main_skill_level && ` (${p.main_skill_level})`}</>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </Section>
          )}

          {!loading && results && results.skills.length > 0 && (
            <Section title="Skills" count={results.skills.length}>
              {results.skills.map(s => (
                <button
                  key={`s-${s.id}`}
                  type="button"
                  onClick={() => go(`/matriz-conhecimento?skill=${s.id}`)}
                  style={rowStyle()}
                >
                  <Star size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {s.category}
                    </div>
                  </div>
                </button>
              ))}
            </Section>
          )}

          {!loading && results && results.projects.length > 0 && (
            <Section title="Projetos" count={results.projects.length}>
              {results.projects.map(p => (
                <button
                  key={`pr-${p.id}`}
                  type="button"
                  onClick={() => go(`/projetos/cobertura-skills?project=${p.id}`)}
                  style={rowStyle()}
                >
                  <FolderOpen size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {p.code}
                    </div>
                  </div>
                </button>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  title, count, children,
}: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        padding: '8px 12px 4px',
        fontSize: 10, fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        {title} · {count}
      </div>
      {children}
    </div>
  )
}

function rowStyle(): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    borderTop: '1px solid var(--border)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
  }
}
