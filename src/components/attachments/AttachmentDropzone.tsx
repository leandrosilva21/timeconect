'use client'

// FASE 11.2.FE — Dropzone canônico de upload.
//
// Substitui `<label><input type="file"/></label>` artesanal espalhado pelas
// telas. Suporta:
//  - clique para abrir picker
//  - drag-drop com feedback visual
//  - múltiplos arquivos (multi=true)
//  - validação cliente: maxMb por arquivo, accept (MIME ou extensão)
//  - estado disabled durante upload
//
// Não chama o BE direto — ENTREGA File ao caller via onFiles. Caller usa
// useAttachments.upload(file) (ou múltipla iteração) pra disparar a request.
// Isso mantém o componente desacoplado do endpoint específico.

import { useRef, useState } from 'react'
import { Paperclip, UploadCloud } from 'lucide-react'

interface AttachmentDropzoneProps {
  /** Disparado quando o user seleciona/arrasta arquivos (já filtrados por accept/maxMb). */
  onFiles: (files: File[]) => void
  /** Permite múltiplos arquivos. Default true. */
  multiple?: boolean
  /** Limite em MB por arquivo (rejeita silenciosamente os maiores). */
  maxMb?: number
  /** Filtro MIME pra input — ex: "image/*,application/pdf". */
  accept?: string
  disabled?: boolean
  /** Mensagem mostrada no centro. */
  label?: string
  /** Estilo compacto — só botão, sem dropzone visual. Pra usar em headers. */
  compact?: boolean
  className?: string
}

export function AttachmentDropzone({
  onFiles,
  multiple = true,
  maxMb,
  accept,
  disabled,
  label = 'Arraste arquivos ou clique para selecionar',
  compact = false,
  className,
}: AttachmentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const filterFiles = (list: FileList | null): File[] => {
    if (!list) return []
    const arr = Array.from(list)
    const maxBytes = maxMb ? maxMb * 1024 * 1024 : Number.POSITIVE_INFINITY
    return arr.filter(f => f.size <= maxBytes)
  }

  const handleSelect = (list: FileList | null) => {
    const files = filterFiles(list)
    if (files.length > 0) onFiles(files)
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className ?? ''}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-40"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          <Paperclip size={13} />
          Anexar arquivo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          style={{ display: 'none' }}
          onChange={(e) => { handleSelect(e.target.files); e.target.value = '' }}
        />
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border-2 border-dashed transition-colors ${className ?? ''}`}
      style={{
        borderColor: dragging ? 'var(--primary)' : 'var(--border)',
        background: dragging ? 'var(--primary-soft)' : 'var(--surface)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (disabled) return
        handleSelect(e.dataTransfer.files)
      }}
    >
      <div className="flex flex-col items-center justify-center px-4 py-6 gap-2">
        <UploadCloud size={28} style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</p>
        <p className="text-[11px]" style={{ color: 'var(--text-light)' }}>
          {accept ? `Aceita: ${accept}` : 'Qualquer formato'}
          {maxMb ? ` · até ${maxMb} MB por arquivo` : ''}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        style={{ display: 'none' }}
        onChange={(e) => { handleSelect(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
