'use client'

import { useRef, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { toast } from 'sonner'

interface Props {
  stageId: number
  onCreated: () => void
  /** Esconde o composer quando user não pode escrever. */
  canWrite?: boolean
}

const MAX_BYTES = 20 * 1024 * 1024 // 20MB

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export function StageCommentComposer({ stageId, onCreated, canWrite = true }: Props) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  if (!canWrite) return null

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_BYTES) {
      toast.error('Anexo excede 20MB')
      e.target.value = ''
      return
    }
    setFile(f)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const trimmed = text.trim()
    if (trimmed.length === 0 && !file) {
      toast.error('Escreva um comentário ou anexe um arquivo')
      return
    }

    const fd = new FormData()
    if (trimmed) fd.append('text', trimmed)
    if (file) fd.append('attachment', file)

    setSaving(true)
    try {
      await api.post(`/stages/${stageId}/comments`, fd)
      setText('')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      onCreated()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erro ao comentar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="ds-card"
      style={{
        padding: 10,
        marginBottom: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Comentar nesta etapa…"
        rows={2}
        maxLength={5000}
        className="ds-input"
        style={{
          width: '100%', padding: 8, fontSize: 13,
          resize: 'vertical', fontFamily: 'inherit',
        }}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e as unknown as React.FormEvent)
        }}
      />

      {file && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px',
          background: 'var(--surface-hover)',
          borderRadius: 4,
          fontSize: 11, color: 'var(--text-muted)',
        }}>
          <Paperclip size={11} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name} <span style={{ color: 'var(--text-light)' }}>· {formatSize(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = '' }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
            aria-label="Remover anexo"
          >
            <X size={11} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="file"
          ref={fileInput}
          onChange={pickFile}
          style={{ display: 'none' }}
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="ds-btn-ghost"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, padding: '4px 8px',
            color: 'var(--text-muted)',
          }}
        >
          <Paperclip size={12} /> Anexar
        </button>

        <div style={{ flex: 1, fontSize: 10, color: 'var(--text-light)' }}>
          Ctrl/⌘+Enter envia
        </div>

        <button
          type="submit"
          disabled={saving || (text.trim().length === 0 && !file)}
          className="ds-btn-primary"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, padding: '4px 12px',
          }}
        >
          <Send size={11} /> {saving ? 'Enviando…' : 'Comentar'}
        </button>
      </div>
    </form>
  )
}
