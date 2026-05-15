'use client'

import { Bot, Users, Zap } from 'lucide-react'
import type { ConversationSummary, PresenceStatusValue } from '@/types/inbox'
import { PresenceDot } from './PresenceDot'

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'
}

interface Props {
  conversation: ConversationSummary | null
  presenceByUser?: Map<number, PresenceStatusValue>
}

export function InboxHeader({ conversation, presenceByUser }: Props) {
  if (!conversation) {
    return (
      <header className="h-16 border-b border-zinc-800 px-5 flex items-center text-sm text-zinc-500">
        Operational Inbox
      </header>
    )
  }

  const c = conversation

  if (c.type === 'bot') {
    return (
      <header className="h-16 border-b border-zinc-800 px-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-emerald-500/40 to-emerald-700/30 text-emerald-300 ring-1 ring-emerald-500/50 flex items-center justify-center shrink-0">
          <Bot size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold truncate text-emerald-300">{c.title}</h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
              <Zap size={10}/> Sistema
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">
            Alertas operacionais, diagnósticos IA e eventos do Health Engine
          </p>
        </div>
      </header>
    )
  }

  if (c.type === 'group') {
    return (
      <header className="h-16 border-b border-zinc-800 px-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30 flex items-center justify-center shrink-0">
          <Users size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate text-zinc-100">{c.title}</h2>
          <p className="text-[11px] text-zinc-500">
            Grupo · {c.participants_count ?? '?'} participantes
          </p>
        </div>
      </header>
    )
  }

  // direct
  const other = c.other_user
  const presence = other ? presenceByUser?.get(other.id) : undefined

  return (
    <header className="h-16 border-b border-zinc-800 px-5 flex items-center gap-3">
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-md bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700 flex items-center justify-center font-semibold text-xs">
          {initials(other?.name ?? c.title)}
        </div>
        {presence && (
          <PresenceDot status={presence} className="absolute -bottom-0.5 -right-0.5 border-2 border-zinc-950" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold truncate text-zinc-100">{other?.name ?? c.title}</h2>
        <p className="text-[11px] text-zinc-500">
          {presence === 'online' ? 'Online agora'
            : presence === 'away'   ? 'Ausente'
            : presence === 'offline' ? 'Offline'
            : 'Conversa direta'}
        </p>
      </div>
    </header>
  )
}
