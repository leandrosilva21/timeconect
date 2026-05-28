'use client'

import { useRef, useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Upload, Download, Check, X } from 'lucide-react'

export type DocPayload = {
  has_file: boolean
  original_name: string | null
  status: 'pending' | 'accepted' | 'rejected' | string
  reject_reason: string | null
  decided_by: string | null
  decided_at: string | null
}
export type NotasPayload = { nfse: DocPayload; nota_debito: DocPayload } | null

const DOCS = [
  { key: 'nfse', label: 'NFS-e' },
  { key: 'nota_debito', label: 'Nota de débito' },
] as const

/**
 * Célula de notas fiscais PJ (NFS-e + Nota de débito) na linha do fechamento.
 * `type` = consultor|parceiro. Upload por quem pode (consultor próprio/parceiro/admin);
 * aceite/recusa só admin (`canDecide`). Recusa exige motivo; aceite vira flag "Aceita".
 */
export function NotasPjCell({
  type, id, yearMonth, notas, canDecide, canUpload, onChanged,
}: {
  type: 'consultor' | 'parceiro'
  id: number
  yearMonth: string
  notas: NotasPayload
  canDecide: boolean
  canUpload: boolean
  onChanged: (n: NotasPayload) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const nfseRef = useRef<HTMLInputElement>(null)
  const notaRef = useRef<HTMLInputElement>(null)
  const refFor = (k: string) => (k === 'nfse' ? nfseRef : notaRef)

  // Entidade não-PJ (ou sem bloco de notas): nada a mostrar.
  if (!notas) return <span className="text-zinc-600">—</span>

  async function doUpload(tipo: string, file: File) {
    setBusy(tipo)
    try {
      const fd = new FormData()
      fd.append('tipo', tipo)
      fd.append('file', file)
      const r = await api.post<{ notas: NotasPayload }>(`/fechamento/notas/${type}/${id}/${yearMonth}`, fd)
      onChanged(r.notas)
      toast.success('Nota enviada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao enviar a nota')
    } finally { setBusy(null) }
  }

  async function download(tipo: string, name: string | null) {
    setBusy(tipo)
    try {
      const res = await fetch(`/api/v1/fechamento/notas/${type}/${id}/${yearMonth}/${tipo}/download`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Falha ao baixar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name ?? `${tipo}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao baixar')
    } finally { setBusy(null) }
  }

  async function decide(tipo: string, decisao: 'accepted' | 'rejected', mot?: string) {
    setBusy(tipo)
    try {
      const r = await api.post<{ notas: NotasPayload }>(
        `/fechamento/notas/${type}/${id}/${yearMonth}/${tipo}/decisao`,
        { decisao, motivo: mot },
      )
      onChanged(r.notas)
      setRejecting(null); setMotivo('')
      toast.success(decisao === 'accepted' ? 'Nota aceita' : 'Nota recusada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha na decisão')
    } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {DOCS.map(({ key, label }) => {
        const d = notas[key]
        return (
          <div key={key} className="flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-400 w-[78px] shrink-0">{label}</span>

            {d.status === 'accepted' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/15 text-green-400">✓ Nota aceita</span>
            )}
            {d.status === 'rejected' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-400">✗ Recusada</span>
            )}
            {d.status === 'pending' && d.has_file && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400">Pendente</span>
            )}
            {!d.has_file && (
              <span className="text-zinc-600 text-[10px]">sem anexo</span>
            )}

            {d.has_file && (
              <button disabled={busy === key} onClick={() => download(key, d.original_name)}
                className="text-cyan-400 hover:text-cyan-300 disabled:opacity-50" title={d.original_name ?? 'Baixar'}>
                <Download size={12} />
              </button>
            )}

            {canUpload && (
              <>
                <input ref={refFor(key)} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(key, f); e.currentTarget.value = '' }} />
                <button disabled={busy === key} onClick={() => refFor(key).current?.click()}
                  className="text-zinc-400 hover:text-zinc-200 disabled:opacity-50" title={d.has_file ? 'Substituir anexo' : 'Enviar anexo'}>
                  <Upload size={12} />
                </button>
              </>
            )}

            {canDecide && d.has_file && d.status === 'pending' && rejecting !== key && (
              <>
                <button disabled={busy === key} onClick={() => decide(key, 'accepted')}
                  className="text-green-400 hover:text-green-300 disabled:opacity-50" title="Aceitar nota"><Check size={12} /></button>
                <button disabled={busy === key} onClick={() => { setRejecting(key); setMotivo('') }}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50" title="Recusar nota"><X size={12} /></button>
              </>
            )}

            {canDecide && rejecting === key && (
              <span className="flex items-center gap-1">
                <input autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo da recusa"
                  className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-[10px] w-32" />
                <button disabled={busy === key || !motivo.trim()} onClick={() => decide(key, 'rejected', motivo.trim())}
                  className="text-red-400 font-semibold disabled:opacity-40">OK</button>
                <button onClick={() => { setRejecting(null); setMotivo('') }} className="text-zinc-500">cancelar</button>
              </span>
            )}

            {d.status === 'rejected' && d.reject_reason && rejecting !== key && (
              <span className="text-red-300/70 text-[10px] truncate max-w-[140px]" title={d.reject_reason}>— {d.reject_reason}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
