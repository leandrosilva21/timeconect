'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bot } from 'lucide-react'
import type { InboxMessage } from '@/types/inbox'

interface Props {
  message: InboxMessage
  isOwn: boolean
  /**
   * Quando true, suprime avatar/header — significa que a mensagem anterior é
   * do mesmo sender e foi enviada em uma janela curta (~2min). Estilo Slack.
   */
  compact?: boolean
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'
}

export function ChatMessageItem({ message, isOwn, compact = false }: Props) {
  const sender = message.sender
  const isBotMsg = ['bot', 'ai_insight', 'alert', 'system'].includes(message.type.value)
  const time = format(new Date(message.created_at), 'HH:mm', { locale: ptBR })

  return (
    <div className={[
      'flex items-start gap-2.5 group',
      isOwn ? 'flex-row-reverse' : '',
      compact ? 'mt-0.5' : 'mt-3',
    ].join(' ')}>
      {compact ? (
        // Avatar invisível mantém alinhamento, mostra hora no hover
        <div className="w-8 shrink-0 text-right pr-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[var(--text-light)] pt-1">
          {time}
        </div>
      ) : (
        <div className={[
          'w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-[11px] font-semibold ring-1',
          isBotMsg
            ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 text-emerald-700 dark:text-emerald-300 ring-emerald-500/40'
            : isOwn
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30'
              : 'bg-[var(--surface-hover)] text-[var(--text-muted)] ring-[var(--brand-border)]',
        ].join(' ')}>
          {isBotMsg ? <Bot size={14} /> : (sender ? initials(sender.name) : '?')}
        </div>
      )}
      <div className={['max-w-[70%] flex flex-col', isOwn ? 'items-end' : 'items-start'].join(' ')}>
        {!compact && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {isBotMsg ? 'BOT Minutor' : sender?.name ?? 'Usuário'}
            </span>
            <span className="text-[10px] text-[var(--text-light)]">{time}</span>
          </div>
        )}
        <div className={[
          'rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
          isOwn
            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 dark:text-emerald-50'
            : 'bg-[var(--surface)] border border-[var(--brand-border)] text-[var(--text)]',
        ].join(' ')}>
          {message.body}
        </div>
      </div>
    </div>
  )
}
