'use client'

import { Bot, Inbox as InboxIcon, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ConversationSummary } from '@/types/inbox'

interface ConversationsSidebarProps {
  conversations: ConversationSummary[]
  selectedId: number | null
  onSelect: (id: number) => void
  loading?: boolean
}

const TYPE_ICON = {
  bot:    Bot,
  group:  Users,
  direct: InboxIcon,
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

export function ConversationsSidebar({
  conversations, selectedId, onSelect, loading,
}: ConversationsSidebarProps) {
  return (
    <aside className="w-80 shrink-0 border-r border-zinc-800 bg-zinc-950/40 overflow-y-auto">
      <div className="p-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-300 text-sm font-medium">
          <InboxIcon size={16} /> Operational Inbox
        </div>
      </div>

      {loading && conversations.length === 0 ? (
        <div className="p-4 text-xs text-zinc-500">Carregando…</div>
      ) : conversations.length === 0 ? (
        <div className="p-4 text-xs text-zinc-500">Nenhuma conversa ainda.</div>
      ) : (
        <ul className="py-1">
          {conversations.map(c => {
            const Icon = TYPE_ICON[c.type]
            const isSelected = selectedId === c.id
            const isBot = c.type === 'bot'
            const relative = c.last_message_at
              ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: ptBR })
              : null

            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={[
                    'w-full text-left flex items-start gap-3 px-3 py-3 border-l-2 transition-colors',
                    isSelected
                      ? 'bg-zinc-900 border-l-emerald-500'
                      : 'border-l-transparent hover:bg-zinc-900/50',
                  ].join(' ')}
                >
                  <div className={[
                    'mt-0.5 w-9 h-9 rounded-md flex items-center justify-center shrink-0 ring-1',
                    isBot
                      ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 text-emerald-300 ring-emerald-500/40'
                      : 'bg-zinc-800 text-zinc-400 ring-zinc-700',
                  ].join(' ')}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={[
                          'text-sm font-semibold truncate',
                          isBot ? 'text-emerald-300' : 'text-zinc-200',
                        ].join(' ')}>
                          {c.title}
                        </span>
                        {isBot && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                            BOT
                          </span>
                        )}
                      </div>
                      {relative && (
                        <span className="text-[10px] text-zinc-500 whitespace-nowrap shrink-0">{relative}</span>
                      )}
                    </div>

                    {isBot ? (
                      <p className="mt-0.5 text-[10px] text-zinc-500 uppercase tracking-wider">Entidade Operacional</p>
                    ) : c.customer ? (
                      <p className="mt-0.5 text-[10px] text-zinc-500">{c.customer.name}</p>
                    ) : null}

                    <SeverityPills s={c.unread_by_severity} />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
