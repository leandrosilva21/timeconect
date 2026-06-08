'use client'

// FASE 11.2.FE — Hook canônico de anexos do TimeConect.
//
// Substitui o fetch ad-hoc espalhado pelo código. Toda tela que tiver upload,
// listagem ou delete de anexos passa por aqui. Disparou `refresh()` após qualquer
// mutation pra manter a UI consistente sem refetch manual.
//
// Uso:
//   const { items, loading, error, upload, remove, refresh } = useAttachments({
//     entityType: 'EXPENSE',
//     entityId: expense.id,
//     category: 'receipt',          // opcional — sem isso lista todas
//   })

import { useCallback, useEffect, useState } from 'react'
import {
  Attachment,
  AttachmentEntityType,
  AttachmentVisibility,
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from '@/lib/attachments'

export interface UseAttachmentsOpts {
  entityType: AttachmentEntityType
  /**
   * Quando null/undefined, o hook fica "idle" — não faz request. Útil pra modais
   * que abrem com a entidade ainda não criada (ex.: criar despesa, depois subir
   * recibo). Quando a entidade nascer, reativa.
   */
  entityId: number | null | undefined
  category?: string
  /**
   * Quando true (default), busca a lista no mount/changeId.
   * Útil deixar `false` em flows que carregam sob demanda (clique).
   */
  autoLoad?: boolean
}

export interface UseAttachmentsResult {
  items: Attachment[]
  loading: boolean
  error: string | null
  upload: (file: File, opts?: { visibility?: AttachmentVisibility }) => Promise<Attachment>
  remove: (id: number) => Promise<void>
  refresh: () => Promise<void>
}

export function useAttachments(opts: UseAttachmentsOpts): UseAttachmentsResult {
  const { entityType, entityId, category, autoLoad = true } = opts
  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (entityId == null) {
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await listAttachments(entityType, entityId, category)
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar anexos.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId, category])

  useEffect(() => {
    if (autoLoad) void refresh()
  }, [autoLoad, refresh])

  const upload = useCallback<UseAttachmentsResult['upload']>(async (file, uploadOpts) => {
    if (entityId == null) throw new Error('entityId obrigatório pra upload.')
    if (category == null) {
      throw new Error('category obrigatório pra upload via hook — passe `category` no useAttachments.')
    }
    const att = await uploadAttachment({
      entityType,
      entityId,
      category,
      file,
      visibility: uploadOpts?.visibility,
    })
    // Otimista: adiciona ao começo da lista; refresh confirma.
    setItems(prev => [att, ...prev.filter(x => x.id !== att.id)])
    return att
  }, [entityType, entityId, category])

  const remove = useCallback<UseAttachmentsResult['remove']>(async (id) => {
    await deleteAttachment(id)
    setItems(prev => prev.filter(x => x.id !== id))
  }, [])

  return { items, loading, error, upload, remove, refresh }
}
