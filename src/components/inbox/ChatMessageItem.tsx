'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bot } from 'lucide-react'
import type { InboxMessage } from '@/types/inbox'

interface Props {
  message: InboxMessage
  isOwn: boolean
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'
}

export function ChatMessageItem({ message, isOwn }: Props) {
  const sender = message.sender
  const isBotMsg = ['bot', 'ai_insight', 'alert', 'system'].includes(message.type.value)
  const time = format(new Date(message.created_at), 'HH:mm', { locale: ptBR })

  return (
    <div className={['flex items-start gap-2.5 mb-3 group', isOwn ? 'flex-row-reverse' : ''].join(' ')}>
      <div className={[
        'w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-[11px] font-semibold ring-1',
        isBotMsg
          ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 text-emerald-300 ring-emerald-500/40'
          : isOwn
            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
            : 'bg-zinc-800 text-zinc-300 ring-zinc-700',
      ].join(' ')}>
        {isBotMsg ? <Bot size={14} /> : (sender ? initials(sender.name) : '?')}
      </div>
      <div className={['max-w-[70%] flex flex-col', isOwn ? 'items-end' : 'items-start'].join(' ')}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-medium text-zinc-300">
            {isBotMsg ? 'BOT Minutor' : sender?.name ?? 'Usuário'}
          </span>
          <span className="text-[10px] text-zinc-600">{time}</span>
        </div>
        <div className={[
          'rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
          isOwn
            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-50'
            : 'bg-zinc-900 border border-zinc-800 text-zinc-200',
        ].join(' ')}>
          {message.body}
        </div>
      </div>
    </div>
  )
}
