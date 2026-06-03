'use client'

// FASE 11.2.FE — Lista canônica de anexos.
//
// Renderiza a lista do useAttachments com loading/empty/error consistentes.
// Cada item usa o AttachmentChip; suporte a remover/sortear via prop.

import { AlertCircle, Loader2, Paperclip } from 'lucide-react'
import { AttachmentChip } from './AttachmentChip'
import type { Attachment } from '@/lib/attachments'

interface AttachmentListProps {
  items: Attachment[]
  loading?: boolean
  error?: string | null
  /** Permite remover */
  onRemove?: (id: number) => void
  /** Mensagem quando vazio */
  emptyMessage?: string
  /** layout: 'wrap' (chips inline) | 'stack' (vertical, mais espaçado) */
  layout?: 'wrap' | 'stack'
  className?: string
}

export function AttachmentList({
  items,
  loading,
  error,
  onRemove,
  emptyMessage = 'Sem anexos.',
  layout = 'wrap',
  className,
}: AttachmentListProps) {
  if (loading && items.length === 0) {
    return (
      <div className={`inline-flex items-center gap-2 text-xs ${className ?? ''}`} style={{ color: 'var(--text-muted)' }}>
        <Loader2 size={12} className="animate-spin" />
        Carregando anexos…
      </div>
    )
  }

  if (error) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs ${className ?? ''}`} style={{ color: 'var(--danger)' }}>
        <AlertCircle size={12} />
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs ${className ?? ''}`} style={{ color: 'var(--text-light)' }}>
        <Paperclip size={11} />
        {emptyMessage}
      </div>
    )
  }

  const containerClass = layout === 'wrap'
    ? 'flex flex-wrap gap-1.5'
    : 'flex flex-col gap-1.5'

  return (
    <div className={`${containerClass} ${className ?? ''}`}>
      {items.map(att => (
        <AttachmentChip key={att.id} attachment={att} onRemove={onRemove} />
      ))}
    </div>
  )
}
