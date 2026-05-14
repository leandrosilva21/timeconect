'use client'

import { Bot, Zap } from 'lucide-react'
import type { ConversationSummary } from '@/types/inbox'

export function InboxHeader({ conversation }: { conversation: ConversationSummary | null }) {
  if (!conversation) {
    return (
      <header className="h-16 border-b border-zinc-800 px-5 flex items-center text-sm text-zinc-500">
        Operational Inbox
      </header>
    )
  }

  const isBot = conversation.type === 'bot'

  return (
    <header className="h-16 border-b border-zinc-800 px-5 flex items-center gap-3">
      <div className={[
        'w-10 h-10 rounded-md flex items-center justify-center shrink-0 ring-1',
        isBot
          ? 'bg-gradient-to-br from-emerald-500/40 to-emerald-700/30 text-emerald-300 ring-emerald-500/50'
          : 'bg-zinc-800 text-zinc-300 ring-zinc-700',
      ].join(' ')}>
        <Bot size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className={[
            'text-sm font-semibold truncate',
            isBot ? 'text-emerald-300' : 'text-zinc-100',
          ].join(' ')}>
            {conversation.title}
          </h2>
          {isBot && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
              <Zap size={10}/> Sistema
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-500">
          {isBot
            ? 'Entidade operacional central — alertas, diagnósticos IA e eventos do Health Engine.'
            : conversation.customer?.name ?? '—'}
        </p>
      </div>
    </header>
  )
}
