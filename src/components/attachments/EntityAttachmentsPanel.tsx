'use client'

// FASE 11.2.FE — Painel completo de anexos pra uma entidade.
//
// Combina useAttachments + AttachmentList + AttachmentDropzone num único
// componente. Telas embedam com ~5 linhas:
//
//   <EntityAttachmentsPanel
//     entityType="PROJECT"
//     entityId={project.id}
//     category="proposal"
//     accept="application/pdf"
//     maxMb={20}
//   />
//
// Cobre o caso comum: lista existente + dropzone pra adicionar + X pra remover.
// Erros aparecem inline (não quebra layout). Empty state controlado por prop.

import { useState } from 'react'
import { toast } from 'sonner'
import { AttachmentDropzone } from './AttachmentDropzone'
import { AttachmentList } from './AttachmentList'
import { useAttachments } from '@/hooks/use-attachments'
import type { AttachmentEntityType, AttachmentVisibility } from '@/lib/attachments'

interface EntityAttachmentsPanelProps {
  entityType: AttachmentEntityType
  entityId: number | null | undefined
  category: string
  /**
   * Título opcional ("Comprovantes", "Propostas", "Documentos"...).
   * Omitir esconde o título (uso em modais que já têm cabeçalho próprio).
   */
  title?: string
  /** Filtro MIME pro picker; ex: 'application/pdf,image/*'. */
  accept?: string
  /** Limite por arquivo (MB). BE valida de novo via registry. */
  maxMb?: number
  /** Permitir upload? false = só lista (read-only). Default true. */
  allowUpload?: boolean
  /** Permitir remover? false = oculta o X dos chips. Default true. */
  allowDelete?: boolean
  /** Quando vazio e read-only, esconde o painel todo. */
  hideWhenEmpty?: boolean
  /** Visibilidade default no upload novo. */
  defaultVisibility?: AttachmentVisibility
  /** Mensagem do dropzone. */
  dropzoneLabel?: string
  /** Variante: full (dropzone visual) | compact (só botão Anexar). */
  variant?: 'full' | 'compact'
  className?: string
}

export function EntityAttachmentsPanel({
  entityType,
  entityId,
  category,
  title,
  accept,
  maxMb,
  allowUpload = true,
  allowDelete = true,
  hideWhenEmpty = false,
  defaultVisibility,
  dropzoneLabel,
  variant = 'full',
  className,
}: EntityAttachmentsPanelProps) {
  const { items, loading, error, upload, remove } = useAttachments({
    entityType,
    entityId,
    category,
  })

  const [uploading, setUploading] = useState(false)

  if (hideWhenEmpty && !loading && !error && items.length === 0 && !allowUpload) {
    return null
  }

  const handleFiles = async (files: File[]) => {
    if (entityId == null) {
      toast.error('A entidade ainda não foi criada. Salve antes de anexar.')
      return
    }
    setUploading(true)
    try {
      for (const file of files) {
        try {
          await upload(file, { visibility: defaultVisibility })
        } catch (e) {
          toast.error(e instanceof Error ? e.message : `Falha ao enviar "${file.name}".`)
        }
      }
      if (files.length > 0) {
        toast.success(files.length === 1 ? 'Anexo enviado.' : `${files.length} anexos enviados.`)
      }
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async (id: number) => {
    if (!confirm('Remover este anexo?')) return
    try {
      await remove(id)
      toast.success('Anexo removido.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao remover.')
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      {title && (
        <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-light)' }}>
          {title}
        </div>
      )}
      <AttachmentList
        items={items}
        loading={loading}
        error={error}
        onRemove={allowDelete ? handleRemove : undefined}
        emptyMessage={allowUpload ? 'Nenhum anexo. Adicione abaixo.' : 'Sem anexos.'}
      />
      {allowUpload && (
        <AttachmentDropzone
          onFiles={handleFiles}
          accept={accept}
          maxMb={maxMb}
          multiple
          disabled={uploading || entityId == null}
          compact={variant === 'compact'}
          label={dropzoneLabel}
        />
      )}
    </div>
  )
}
