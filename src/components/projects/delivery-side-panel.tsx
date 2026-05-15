'use client'

import { useState, useEffect } from 'react'
import { X, PlusCircle, Clock, MessageSquare, Users, History, FileText } from 'lucide-react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import type { StageDelivery, DeliveryStatus, DeliveryPriority } from '@/lib/types/project-stage'
import { DeliveryTimeline } from './delivery-timeline'
import { ActivityCommentComposer } from './activity-comment-composer'
import { StageActivityTimeline } from './stage-activity-timeline'
import { ActivityAporteDialog } from './activity-aporte-dialog'
import { ActivityTeamAllocation } from './activity-team-allocation'

interface Props {
  delivery: StageDelivery
  projectId: number
  onClose: () => void
  onUpdated: (d: StageDelivery) => void
  onDeleted: (id: number) => void
}

const STATUS_OPTIONS: { value: DeliveryStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'waiting_client', label: 'Aguardando cliente' },
  { value: 'review', label: 'Homologação' },
  { value: 'done', label: 'Concluído' },
]

const PRIORITY_OPTIONS: { value: DeliveryPriority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
]

type Tab = 'detalhes' | 'conversa' | 'equipe' | 'historico'

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'detalhes',  label: 'Detalhes',   icon: FileText },
  { id: 'conversa',  label: 'Conversação', icon: MessageSquare },
  { id: 'equipe',    label: 'Equipe',     icon: Users },
  { id: 'historico', label: 'Histórico',  icon: History },
]

export function DeliverySidePanel({ delivery, projectId, onClose, onUpdated, onDeleted }: Props) {
  const [tab, setTab] = useState<Tab>('detalhes')
  const [title, setTitle] = useState(delivery.title)
  const [description, setDescription] = useState(delivery.description ?? '')
  const [hours, setHours] = useState(String(delivery.hours_planned ?? ''))
  const [priority, setPriority] = useState<DeliveryPriority>(delivery.priority)
  const [status, setStatus] = useState<DeliveryStatus>(delivery.status)
  const [due, setDue] = useState(delivery.due_date ?? '')
  const [clientInvolved, setClientInvolved] = useState<boolean>(delivery.client_involved ?? false)
  const [clientUserId, setClientUserId] = useState<string>(delivery.client_user_id ? String(delivery.client_user_id) : '')
  const [clientEmail, setClientEmail] = useState<string>(delivery.client_email ?? '')
  const [saving, setSaving] = useState(false)
  const [timelineKey, setTimelineKey] = useState(0)
  const [aporteOpen, setAporteOpen] = useState(false)

  useEffect(() => {
    setTitle(delivery.title)
    setDescription(delivery.description ?? '')
    setHours(String(delivery.hours_planned ?? ''))
    setPriority(delivery.priority)
    setStatus(delivery.status)
    setDue(delivery.due_date ?? '')
    setClientInvolved(delivery.client_involved ?? false)
    setClientUserId(delivery.client_user_id ? String(delivery.client_user_id) : '')
    setClientEmail(delivery.client_email ?? '')
    setTab('detalhes')
  }, [delivery.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await api.patch<StageDelivery>(`/deliveries/${delivery.id}`, {
        title: title.trim(),
        description: description.trim() || null,
        hours_planned: hours ? Number(hours) : 0,
        priority,
        status,
        due_date: due || null,
        client_involved: clientInvolved,
        client_user_id: clientInvolved && clientUserId ? Number(clientUserId) : null,
        client_email:   clientInvolved && clientEmail.trim() ? clientEmail.trim() : null,
      })
      onUpdated(updated)
      setTimelineKey(k => k + 1)
      toast.success('Atividade atualizada')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir a atividade "${delivery.title}"?`)) return
    try {
      await api.delete(`/deliveries/${delivery.id}`)
      onDeleted(delivery.id)
      toast.success('Atividade excluída')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao excluir')
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)', zIndex: 40,
        }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(640px, 100vw)',
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
          zIndex: 50,
          display: 'flex', flexDirection: 'column',
          animation: 'slideIn .18s ease',
        }}
      >
        <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>

        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Atividade #{delivery.id}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {delivery.title}
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

        {/* Action bar — sempre visível, sem depender da tab */}
        <div style={{
          padding: '8px 18px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex', gap: 6, flexWrap: 'wrap',
        }}>
          <button
            type="button"
            onClick={() => setAporteOpen(true)}
            className="ds-btn-ghost"
            style={{
              fontSize: 12, padding: '5px 10px',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              color: 'var(--primary)',
            }}
            title="Aportar horas com justificativa"
          >
            <PlusCircle size={12} /> Aportar
          </button>
          <Link
            href={`/timesheets/new?project_id=${projectId}&stage_delivery_id=${delivery.id}`}
            className="ds-btn-ghost"
            style={{
              fontSize: 12, padding: '5px 10px',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              color: 'var(--text)',
              textDecoration: 'none',
            }}
            title="Apontar horas trabalhadas nesta atividade"
          >
            <Clock size={12} /> Apontar
          </Link>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                  color: active ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 400,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  transition: 'color .12s ease, border-color .12s ease',
                }}
              >
                <Icon size={12} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
          {tab === 'detalhes' && (
            <>
              <input
                className="ds-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Título"
                style={{ width: '100%', fontSize: 16, fontWeight: 500, padding: '10px 12px' }}
              />

              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descrição (opcional)"
                rows={3}
                className="ds-input"
                style={{ width: '100%', marginTop: 10, padding: 10, resize: 'vertical', fontFamily: 'inherit' }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                <Field label="Status">
                  <select
                    className="ds-input"
                    value={status}
                    onChange={e => setStatus(e.target.value as DeliveryStatus)}
                    style={{ width: '100%' }}
                  >
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>

                <Field label="Prioridade">
                  <select
                    className="ds-input"
                    value={priority}
                    onChange={e => setPriority(e.target.value as DeliveryPriority)}
                    style={{ width: '100%' }}
                  >
                    {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>

                <Field label="Horas previstas">
                  <input
                    type="number" min={0} step="0.5"
                    className="ds-input"
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </Field>

                <Field label="Prazo">
                  <input
                    type="date"
                    className="ds-input"
                    value={due}
                    onChange={e => setDue(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </Field>
              </div>

              <ClientInvolvementSection
                involved={clientInvolved}
                userId={clientUserId}
                email={clientEmail}
                onChangeInvolved={setClientInvolved}
                onChangeUserId={setClientUserId}
                onChangeEmail={setClientEmail}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ds-btn-primary"
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  style={{ fontSize: 13, padding: '8px 16px' }}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  style={{
                    fontSize: 13, padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--danger)',
                    borderRadius: 6, cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  Excluir
                </button>
              </div>
            </>
          )}

          {tab === 'conversa' && (
            <>
              <div style={{ marginBottom: 12 }}>
                <ActivityCommentComposer
                  deliveryId={delivery.id}
                  onCreated={() => setTimelineKey(k => k + 1)}
                />
              </div>
              <StageActivityTimeline
                key={`conv-${timelineKey}`}
                deliveryId={delivery.id}
              />
            </>
          )}

          {tab === 'equipe' && (
            <ActivityTeamAllocation deliveryId={delivery.id} />
          )}

          {tab === 'historico' && (
            <DeliveryTimeline key={`hist-${timelineKey}`} deliveryId={delivery.id} />
          )}
        </div>

        {aporteOpen && (
          <ActivityAporteDialog
            deliveryId={delivery.id}
            deliveryName={delivery.title}
            deliveryHoursPlanned={Number(delivery.hours_planned ?? 0)}
            projectId={projectId}
            onClose={() => setAporteOpen(false)}
            onCreated={() => {
              setAporteOpen(false)
              setTimelineKey(k => k + 1)
              onUpdated({ ...delivery })
            }}
          />
        )}
      </aside>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{
        display: 'block', fontSize: 11, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4,
      }}>
        {label}
      </span>
      {children}
    </label>
  )
}

interface ClientUserOption {
  id: number
  name: string
  email?: string | null
}

function ClientInvolvementSection({
  involved, userId, email, onChangeInvolved, onChangeUserId, onChangeEmail,
}: {
  involved: boolean
  userId: string
  email: string
  onChangeInvolved: (v: boolean) => void
  onChangeUserId: (v: string) => void
  onChangeEmail: (v: string) => void
}) {
  const [clients, setClients] = useState<ClientUserOption[]>([])
  const [search, setSearch] = useState('')
  const [loadingList, setLoadingList] = useState(false)

  useEffect(() => {
    if (!involved) return
    setLoadingList(true)
    api.get<{ data?: ClientUserOption[]; items?: ClientUserOption[] } | ClientUserOption[]>(
      `/users?type=cliente&minimal=true&search=${encodeURIComponent(search)}`,
    )
      .then(res => {
        const list = Array.isArray(res) ? res : (res.items ?? res.data ?? [])
        setClients(list ?? [])
      })
      .catch(() => setClients([]))
      .finally(() => setLoadingList(false))
  }, [involved, search])

  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: involved ? 'var(--primary-soft)' : 'var(--surface)',
      }}
    >
      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontSize: 13, color: 'var(--text)', fontWeight: 500, cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={involved}
          onChange={e => onChangeInvolved(e.target.checked)}
        />
        Envolver cliente
      </label>

      {involved && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Cliente cadastrado (opcional)">
            <input
              type="text"
              className="ds-input"
              placeholder="Buscar cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
            <select
              className="ds-input"
              value={userId}
              onChange={e => { onChangeUserId(e.target.value); if (e.target.value) onChangeEmail('') }}
              style={{ width: '100%', marginTop: 6 }}
              disabled={loadingList}
            >
              <option value="">— Selecionar cliente —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ''}</option>
              ))}
            </select>
          </Field>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>ou</div>

          <Field label="E-mail externo (sem login)">
            <input
              type="email"
              className="ds-input"
              placeholder="cliente@empresa.com"
              value={email}
              onChange={e => { onChangeEmail(e.target.value); if (e.target.value) onChangeUserId('') }}
              style={{ width: '100%' }}
            />
          </Field>

          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Cliente cadastrado terá acesso pontual à atividade. E-mail externo recebe apenas notificações.
          </div>
        </div>
      )}
    </div>
  )
}
