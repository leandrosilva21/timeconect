'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AtSign, X } from 'lucide-react'
import { useMentions } from '@/hooks/use-mentions'

const STORAGE_KEY = 'minutor.mentions_last_seen'

function readLastSeen(): number {
  if (typeof window === 'undefined') return 0
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v ? Number(v) : 0
}

function writeLastSeen(ts: number) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, String(ts))
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  return new Date(iso).toLocaleDateString('pt-BR')
}

/** Renderiza texto removendo o token `@[id:Nome]` e mostrando apenas "@Nome" */
function cleanMentionText(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(/@\[(\d+):([^\]]+)\]/g, '@$2')
}

export function MentionsBell() {
  const { items, total, refetch } = useMentions()
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(readLastSeen())
  const ref = useRef<HTMLDivElement>(null)

  // Poll a cada 60s
  useEffect(() => {
    const id = setInterval(refetch, 60_000)
    return () => clearInterval(id)
  }, [refetch])

  // Click fora fecha
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unread = items.filter(m => new Date(m.created_at).getTime() > lastSeen).length

  function handleOpen() {
    setOpen(v => {
      const next = !v
      if (next && items.length > 0) {
        // Marca como visto quando abre
        const newest = new Date(items[0].created_at).getTime()
        writeLastSeen(newest)
        setLastSeen(newest)
      }
      return next
    })
    refetch()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-1.5 rounded-md transition-colors hover:bg-zinc-800"
        style={{ color: open ? 'var(--primary)' : '#71717A' }}
        title="Mentions"
      >
        <AtSign size={16} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center pointer-events-none"
            style={{ background: 'var(--warning)', color: 'var(--primary-fg)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-96 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--brand-border)' }}>
            <div className="flex items-center gap-2">
              <AtSign size={14} style={{ color: 'var(--primary)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>Mentions</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                {total}
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-white/5 transition-colors" style={{ color: 'var(--brand-muted)' }}>
              <X size={12} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-1">
                <AtSign size={20} style={{ color: 'var(--brand-muted)' }} />
                <p className="text-xs" style={{ color: 'var(--brand-subtle)' }}>Nenhuma menção ainda</p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {items.map(m => {
                  const isUnread = new Date(m.created_at).getTime() > lastSeen
                  const href = m.project_id && m.stage_id
                    ? `/projetos/${m.project_id}/cronograma/${m.stage_id}`
                    : '#'
                  return (
                    <li key={m.id} style={{
                      borderBottom: '1px solid var(--border)',
                      background: isUnread ? 'var(--primary-soft)' : 'transparent',
                    }}>
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        style={{
                          display: 'block', padding: '10px 14px',
                          textDecoration: 'none', color: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                          <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{m.actor?.name ?? 'Alguém'}</strong>
                          <span>·</span>
                          <span>{timeAgo(m.created_at)}</span>
                        </div>
                        {m.text && (
                          <div style={{
                            marginTop: 4,
                            fontSize: 12, color: 'var(--text)',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}>
                            {cleanMentionText(m.text)}
                          </div>
                        )}
                        <div style={{
                          marginTop: 4, fontSize: 11, color: 'var(--text-light)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {m.project ?? '—'} · {m.stage ?? '—'} · {m.delivery ?? '—'}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
