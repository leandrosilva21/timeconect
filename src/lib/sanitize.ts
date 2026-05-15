import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'a', 'b', 'br', 'em', 'i', 'img', 'li', 'ol', 'p', 'pre',
  'span', 'strong', 'u', 'ul', 'blockquote', 'code', 'div',
  // Movidesk envia tabelas e headers em htmlDescription (ver MovideskService::buildObservation)
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 's', 'sub', 'sup',
]

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'colspan', 'rowspan', 'align', 'valign', 'style']

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return ''
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|data:image\/(?:png|jpeg|gif|webp));|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  })
}

/**
 * Versão texto plano de um HTML — usada em previews (kanban, listas, tooltips)
 * onde renderizar tags HTML quebraria o layout. Decoda entidades e colapsa
 * espaços/newlines.
 */
export function previewText(input: string | null | undefined): string {
  if (!input) return ''
  // Substitui block tags por espaço pra evitar palavras grudadas
  const withSpaces = String(input).replace(/<\/?(?:p|br|div|li|tr|td|th|h[1-6]|hr)\b[^>]*>/gi, ' ')
  // Remove o resto das tags
  const stripped = withSpaces.replace(/<[^>]*>/g, '')
  // Decoda entidades comuns
  const decoded = stripped
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  return decoded.replace(/\s+/g, ' ').trim()
}
