'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { toast } from 'sonner'

interface ChainItem {
  id: number
  title: string
  current_start: string | null
  current_end: string | null
  suggested_start: string
  suggested_end: string
  hours_planned: number
}

interface Props {
  deliveryId: number | null
  onClose: () => void
  onApplied: () => void
}

/**
 * Modal de cascade FS — preview e apply do recálculo de atividades dependentes
 * após uma edição do predecessor. Default = "Manter como estão" (não rouba agência do coord).
 * ADR 0009 appendix.
 */
export function RecalcDependentsModal({ deliveryId, onClose, onApplied }: Props) {
  const [chain, setChain] = useState<ChainItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!deliveryId) {
      setChain(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setChain(null)
    api.post<{ chain: ChainItem[] }>(`/deliveries/${deliveryId}/recalc-dependents`, { apply: false })
      .then(res => { if (!cancelled) setChain(res.chain ?? []) })
      .catch(e => {
        if (!cancelled) {
          toast.error(e instanceof ApiError ? e.message : 'Erro ao calcular dependentes')
          onClose()
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [deliveryId, onClose])

  if (!deliveryId) return null

  async function apply() {
    if (!deliveryId) return
    setApplying(true)
    try {
      await api.post(`/deliveries/${deliveryId}/recalc-dependents`, { apply: true })
      toast.success('Atividades dependentes recalculadas')
      onApplied()
      onClose()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao recalcular')
    } finally {
      setApplying(false)
    }
  }

  const hasChain = chain && chain.length > 0

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.4)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="ds-card"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: 20,
          maxWidth: 640,
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          border: '1px solid var(--border)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          Recalcular atividades dependentes?
        </h3>
        <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          Esta alteração afeta {chain?.length ?? 0} atividade{(chain?.length ?? 0) === 1 ? '' : 's'} dependente
          {(chain?.length ?? 0) === 1 ? '' : 's'} via Finish-to-Start.
        </p>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, color: 'var(--text-muted)', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" /> Calculando cadeia…
          </div>
        )}

        {!loading && !hasChain && (
          <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            Nenhuma atividade dependente — nada para recalcular.
          </div>
        )}

        {!loading && hasChain && (
          <table style={{ width: '100%', marginTop: 16, fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--text-muted)', fontWeight: 500 }}>Atividade</th>
                <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--text-muted)', fontWeight: 500 }}>Atual</th>
                <th style={{ width: 16 }} />
                <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--text-muted)', fontWeight: 500 }}>Sugerido</th>
              </tr>
            </thead>
            <tbody>
              {chain!.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 4px', color: 'var(--text)' }}>{c.title}</td>
                  <td style={{ padding: '8px 4px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {fmtRange(c.current_start, c.current_end)}
                  </td>
                  <td style={{ padding: '8px 4px', color: 'var(--text-light)' }}>
                    <ArrowRight size={12} />
                  </td>
                  <td style={{ padding: '8px 4px', color: 'var(--primary)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {fmtRange(c.suggested_start, c.suggested_end)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            className="ds-btn-secondary"
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6 }}
            disabled={applying}
          >
            Manter como estão
          </button>
          {hasChain && (
            <button
              onClick={apply}
              className="ds-btn-primary"
              style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              disabled={applying}
            >
              {applying && <Loader2 size={13} className="animate-spin" />}
              Recalcular cascata
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function fmtRange(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  const s = start ? fmtDate(start) : '?'
  const e = end ? fmtDate(end) : '?'
  return `${s} → ${e}`
}

function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}`
}
