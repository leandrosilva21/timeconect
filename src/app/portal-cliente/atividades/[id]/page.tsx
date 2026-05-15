'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { api, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { ArrowLeft, Send, Paperclip } from 'lucide-react'

interface ClientActivity {
  id: number
  title: string
  description: string | null
  status: string
  planned_start_at: string | null
  due_date: string | null
  completed_at: string | null
  responsible_name: string | null
  stage_name: string | null
  project_name: string | null
}

interface TimelineEvent {
  id: number
  type: string
  payload: Record<string, unknown> | null
  attachment_path: string | null
  attachment_original_name: string | null
  created_at: string
  actor: { id: number; name: string; email?: string | null } | null
}

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'Em andamento',
  waiting_client: 'Aguardando cliente',
  review: 'Homologação',
  done: 'Concluída',
}

/**
 * Visão da atividade pelo cliente. Read-only no schedule; pode comentar + anexar.
 * Backend valida: cliente só vê deliveries onde é o `client_user_id` e
 * `client_involved=true`. Ver `ClientActivityController` no backend.
 */
export default function ClientActivityDetailPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [activity, setActivity] = useState<ClientActivity | null>(null)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [act, tl] = await Promise.all([
        api.get<ClientActivity>(`/client/activities/${id}`),
        api.get<{ items: TimelineEvent[] }>(`/client/activities/${id}/timeline`),
      ])
      setActivity(act)
      setEvents(tl.items ?? [])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (id) load() }, [id])

  async function handleSend() {
    if (!text.trim() && !file) {
      toast.error('Escreva um comentário ou anexe um arquivo.')
      return
    }
    setSending(true)
    try {
      const form = new FormData()
      if (text.trim()) form.append('text', text.trim())
      if (file) form.append('attachment', file)
      await api.post(`/client/activities/${id}/comments`, form)
      setText('')
      setFile(null)
      toast.success('Comentário enviado')
      load()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao enviar')
    } finally {
      setSending(false)
    }
  }

  return (
    <AppLayout>
      <div style={{ padding: 24, maxWidth: 880 }}>
        <Link href="/portal-cliente/atividades" style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
          color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 12,
        }}>
          <ArrowLeft size={12} /> Voltar para minhas atividades
        </Link>

        {loading && <div style={{ color: 'var(--text-muted)' }}>Carregando…</div>}
        {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

        {activity && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {activity.project_name ? `${activity.project_name} · ` : ''}{activity.stage_name ?? '—'}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{activity.title}</h1>

            <div style={{
              display: 'flex', gap: 18, marginTop: 12, marginBottom: 18, flexWrap: 'wrap',
              padding: '12px 16px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 13,
            }}>
              <InfoCell label="Status" value={STATUS_LABEL[activity.status] ?? activity.status} />
              <InfoCell label="Responsável" value={activity.responsible_name ?? '—'} />
              <InfoCell label="Início" value={fmtDate(activity.planned_start_at)} />
              <InfoCell label="Prazo" value={fmtDate(activity.due_date)} />
              {activity.completed_at && (
                <InfoCell label="Concluída em" value={fmtDateTime(activity.completed_at)} />
              )}
            </div>

            {activity.description && (
              <div style={{
                padding: '12px 16px', marginBottom: 18,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 13, color: 'var(--text)',
                whiteSpace: 'pre-wrap',
              }}>
                {activity.description}
              </div>
            )}

            <h2 style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
              Conversa
            </h2>

            <div className="ds-card" style={{ padding: 12, marginBottom: 16 }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Escreva um comentário…"
                rows={3}
                className="ds-input"
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', padding: 8, fontSize: 13 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                  fontSize: 12, color: 'var(--text-muted)',
                }}>
                  <Paperclip size={12} />
                  {file ? file.name : 'Anexar arquivo'}
                  <input type="file" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} />
                </label>
                {file && (
                  <button onClick={() => setFile(null)} style={{
                    background: 'transparent', border: 'none', color: 'var(--text-muted)',
                    fontSize: 11, cursor: 'pointer',
                  }}>remover</button>
                )}
                <button
                  type="button"
                  className="ds-btn-primary"
                  onClick={handleSend}
                  disabled={sending}
                  style={{
                    marginLeft: 'auto', fontSize: 12, padding: '6px 12px',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Send size={12} /> {sending ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map(ev => (
                <li key={ev.id} className="ds-card" style={{ padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{ev.actor?.name ?? 'Sistema'} · {labelType(ev.type)}</span>
                    <span>{fmtDateTime(ev.created_at)}</span>
                  </div>
                  {typeof ev.payload?.text === 'string' && (
                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                      {String(ev.payload.text)}
                    </div>
                  )}
                  {ev.attachment_path && (
                    <a
                      href={`/storage/${ev.attachment_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        marginTop: 6, fontSize: 12, color: 'var(--primary)',
                      }}
                    >
                      <Paperclip size={11} /> {ev.attachment_original_name ?? 'anexo'}
                    </a>
                  )}
                </li>
              ))}
              {events.length === 0 && (
                <li style={{
                  padding: '16px', textAlign: 'center',
                  color: 'var(--text-muted)', fontSize: 12,
                  border: '1px dashed var(--border)', borderRadius: 8,
                }}>
                  Nenhuma atividade ainda. Seja o primeiro a comentar.
                </li>
              )}
            </ul>
          </>
        )}
      </div>
    </AppLayout>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function labelType(t: string): string {
  switch (t) {
    case 'comment': return 'Comentário'
    case 'delivery_created': return 'Atividade criada'
    case 'delivery_moved': return 'Status alterado'
    case 'delivery_completed': return 'Atividade concluída'
    case 'client_involved': return 'Cliente envolvido'
    case 'client_removed': return 'Cliente removido'
    default: return t
  }
}
