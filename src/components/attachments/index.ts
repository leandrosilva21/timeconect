// FASE 11.2.FE — Barrel exports da camada FE de anexos.
//
// Uso recomendado nos consumers:
//   import { useAttachments, AttachmentChip, AttachmentList, AttachmentDropzone } from '@/components/attachments'
//   import type { Attachment, AttachmentEntityType } from '@/components/attachments'

export { AttachmentChip } from './AttachmentChip'
export { AttachmentList } from './AttachmentList'
export { AttachmentDropzone } from './AttachmentDropzone'
export { EntityAttachmentsPanel } from './EntityAttachmentsPanel'
export { useAttachments } from '@/hooks/use-attachments'
export type { UseAttachmentsOpts, UseAttachmentsResult } from '@/hooks/use-attachments'
export {
  downloadAttachment,
  getSignedUrl,
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  restoreAttachment,
} from '@/lib/attachments'
export type { Attachment, AttachmentEntityType, AttachmentVisibility } from '@/lib/attachments'
