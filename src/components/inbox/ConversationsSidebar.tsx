'use client'

import { Bot, MessageSquarePlus, Users, User as UserIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ConversationSummary, PresenceStatusValue } from '@/types/inbox'
import { PresenceDot } from './PresenceDot'

interface ConversationsSidebarProps {
  conversations: ConversationSummary[]
  selectedId: number | null
  onSelect: (id: number) => void
  onNew: () => void
  presenceByUser?: Map<number, PresenceStatusValue>
  loading?: boolean
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'
}

function SeverityPills({ s }: { s: ConversationSummary['unread_by_severity'] }) {
  if (!s) return null
  const c = s.critical + s.high
  const a = s.medium
  const i = s.low + s.info
  if (c + a + i === 0) return null

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {c > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500/15 text-red-300 border border-red-500/30">{c} crítico</span>}
      {a > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">{a} atenção</span>}
      {i > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">{i} info</span>}
    </div>
  )
}

function ConversationRow({
  conv, selected, onClick, presence,
}: {
  conv: ConversationSummary
  selected: boolean
  onClick: () => void
  presence?: PresenceStatusValue
}) {
  const isBot = conv.type === 'bot'
  const isGroup = conv.type === 'group'
  const isDirect = conv.type === 'direct'

  const relative = conv.last_message_at
    ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ptBR })
    : null

  const otherName = conv.other_user?.name ?? conv.title
  const previewIsBot = conv.last_message?.type === 'alert' || conv.last_message?.type === 'ai_insight' || conv.last_message?.type === 'bot'

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left flex items-start gap-3 px-3 py-3 border-l-2 transition-colors',
        selected ? 'bg-zinc-900 border-l-emerald-500' : 'border-l-transparent hover:bg-zinc-900/50',
      ].join(' ')}
    >
      <div className="relative shrink-0">
        <div className={[
          'w-9 h-9 rounded-md flex items-center justify-center ring-1 text-[11px] font-semibold',
          isBot
            ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 text-emerald-300 ring-emerald-500/40'
            : isGroup
              ? 'bg-violet-500/15 text-violet-300 ring-violet-500/30'
              : 'bg-zinc-800 text-zinc-300 ring-zinc-700',
        ].join(' ')}>
          {isBot ? <Bot size={16} /> : isGroup ? <Users size={15} /> : initials(otherName)}
        </div>
        {isDirect && presence && (
          <PresenceDot status={presence} className="absolute -bottom-0.5 -right-0.5 border-2 border-zinc-950" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={[
              'text-sm font-semibold truncate',
              isBot ? 'text-emerald-300' : 'text-zinc-200',
            ].join(' ')}>
              {otherName}
            </span>
            {isBot && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                BOT
              </span>
            )}
            {isGroup && (
              <span className="text-[9px] text-zinc-500 ml-1">
                {conv.participants_count ?? '?'}
              </span>
            )}
          </div>
          {relative && (
            <span className="text-[10px] text-zinc-500 whitespace-nowrap shrink-0">{relative}</span>
          )}
        </div>

        {isBot ? (
          <p className="mt-0.5 text-[10px] text-zinc-500 uppercase tracking-wider">Entidade Operacional</p>
        ) : conv.last_message ? (
          <p className={[
            'mt-0.5 text-[11px] truncate',
            previewIsBot ? 'text-emerald-400/80' : 'text-zinc-400',
          ].join(' ')}>
            {previewIsBot && <span className="font-medium">BOT: </span>}
            {conv.last_message.preview}
          </p>
        ) : (
          <p className="mt-0.5 text-[11px] text-zinc-600 italic">Sem mensagens ainda</p>
        )}

        {isBot && <SeverityPills s={conv.unread_by_severity} />}
        {!isBot && conv.unread_count > 0 && (
          <span className="mt-1.5 inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {conv.unread_count} nova(s)
          </span>
        )}
      </div>
    </button>
  )
}

export function ConversationsSidebar({
  conversations, selectedId, onSelect, onNew, presenceByUser, loading,
}: ConversationsSidebarProps) {
  const bots    = conversations.filter(c => c.type === 'bot')
  const direct  = conversations.filter(c => c.type === 'direct')
  const groups  = conversations.filter(c => c.type === 'group')

  return (
    <aside className="w-80 shrink-0 border-r border-zinc-800 bg-zinc-950/40 overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-zinc-300 text-sm font-medium">Conversas</span>
        <button
          type="button"
          onClick={onNew}
          title="Nova conversa"
          className="inline-flex items-center gap-1 text-[11px] text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded"
        >
          <MessageSquarePlus size={12} /> Nova
        </button>
      </div>

      {loading && conversations.length === 0 ? (
        <div className="p-4 text-xs text-zinc-500">Carregando…</div>
      ) : (
        <>
          {bots.length > 0 && (
            <Section title="BOT">
              {bots.map(c => (
                <ConversationRow key={c.id} conv={c} selected={selectedId === c.id} onClick={() => onSelect(c.id)} />
              ))}
            </Section>
          )}

          <Section title="Direct" empty="Nenhuma conversa direta">
            {direct.map(c => (
              <ConversationRow
                key={c.id}
                conv={c}
                selected={selectedId === c.id}
                onClick={() => onSelect(c.id)}
                presence={c.other_user ? presenceByUser?.get(c.other_user.id) : undefined}
              />
            ))}
          </Section>

          <Section title="Grupos" empty="Nenhum grupo">
            {groups.map(c => (
              <ConversationRow key={c.id} conv={c} selected={selectedId === c.id} onClick={() => onSelect(c.id)} />
            ))}
          </Section>
        </>
      )}
    </aside>
  )
}

function Section({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string }) {
  const arr = Array.isArray(children) ? children : [children]
  const hasItems = arr.filter(Boolean).length > 0
  return (
    <div className="border-b border-zinc-800/60">
      <div className="px-3 pt-3 pb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
        <UserIcon size={10} /> {title}
      </div>
      {hasItems ? <ul className="pb-1">{children}</ul> : empty ? (
        <p className="px-3 pb-3 text-[11px] text-zinc-600 italic">{empty}</p>
      ) : null}
    </div>
  )
}
