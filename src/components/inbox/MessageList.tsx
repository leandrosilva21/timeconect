'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Archive, Inbox as InboxIcon, MessageSquare } from 'lucide-react'
import { listMessages, markRead } from '@/lib/inbox'
import { MessageItem } from './MessageItem'
import { ChatMessageItem } from './ChatMessageItem'
import { Composer } from './Composer'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  ConversationSummary, NotificationStatusValue,
} from '@/types/inbox'

type Filter = 'active' | 'all' | 'resolved' | 'archived' | 'snoozed'

const FILTER_QUERY: Record<Filter, string | undefined> = {
  active:   'unread,read',
  all:      undefined,
  resolved: 'resolved',
  archived: 'archived',
  snoozed:  'snoozed',
}

const FILTER_LABEL: Record<Filter, string> = {
  active:   'Ação',
  all:      'Tudo',
  resolved: 'Resolvidas',
  archived: 'Arquivadas',
  snoozed:  'Soneca',
}

interface Props {
  conversation: ConversationSummary | null
  currentUserId: number | null
}

export function MessageList({ conversation, currentUserId }: Props) {
  const isBot = conversation?.type === 'bot'
  const isChat = conversation && conversation.type !== 'bot'

  const [filter, setFilter] = useState<Filter>('active')
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['inbox-messages', conversation?.id, isBot ? filter : 'chat'],
    queryFn: () => {
      const status = isBot ? FILTER_QUERY[filter] : undefined
      return listMessages(conversation!.id, 100).then(d => {
        if (!status) return d
        const allowed = status.split(',') as NotificationStatusValue[]
        return { ...d, data: d.data.filter(m => allowed.includes(m.status)) }
      })
    },
    enabled: !!conversation,
    refetchInterval: 30_000,
  })

  // Marcar conversa como lida ao abrir
  useEffect(() => {
    if (!conversation) return
    if (conversation.unread_count > 0) {
      markRead(conversation.id).catch(() => {})
    }
  }, [conversation?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll para o final em conversas tipo chat
  useEffect(() => {
    if (isChat && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [data?.data?.length, isChat])

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600">
        <div className="text-center">
          <MessageSquare size={36} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-sm">Selecione uma conversa</p>
          <p className="text-xs mt-1 text-zinc-700">Ou crie uma nova no botão acima.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6 flex-1 overflow-y-auto">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="border-l-4 border-zinc-800 bg-zinc-900/30 border border-zinc-800 rounded-md p-4 mb-3">
            <Skeleton className="h-3 w-1/3 bg-zinc-800 mb-2" />
            <Skeleton className="h-3 w-full bg-zinc-800 mb-1" />
            <Skeleton className="h-3 w-3/4 bg-zinc-800" />
          </div>
        ))}
      </div>
    )
  }

  const items = data?.data ?? []

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isBot && (
        <div className="px-5 py-2 flex items-center gap-1 border-b border-zinc-800 bg-zinc-950/40">
          {(Object.keys(FILTER_LABEL) as Filter[]).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={[
                'px-3 py-1 text-[11px] uppercase tracking-wider rounded transition-colors',
                filter === k
                  ? 'bg-zinc-100 text-zinc-900 font-semibold'
                  : 'text-zinc-400 hover:bg-zinc-800',
              ].join(' ')}
            >
              {FILTER_LABEL[k]}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {items.length === 0 ? (
          <div className="flex items-center justify-center text-zinc-600 py-16">
            <div className="text-center">
              {isBot && filter === 'active' ? (
                <>
                  <InboxIcon size={36} className="mx-auto mb-3 text-zinc-700" />
                  <p className="text-sm">Inbox limpo.</p>
                  <p className="text-xs mt-1 text-zinc-700">Nenhum item operacional pendente.</p>
                </>
              ) : isBot ? (
                <>
                  <Archive size={36} className="mx-auto mb-3 text-zinc-700" />
                  <p className="text-sm">Nada por aqui.</p>
                </>
              ) : (
                <>
                  <MessageSquare size={36} className="mx-auto mb-3 text-zinc-700" />
                  <p className="text-sm">Sem mensagens ainda.</p>
                  <p className="text-xs mt-1 text-zinc-700">Diga oi.</p>
                </>
              )}
            </div>
          </div>
        ) : isBot ? (
          items.map(m => <MessageItem key={m.id} message={m} />)
        ) : (
          <>
            {[...items].reverse().map(m => (
              <ChatMessageItem
                key={m.id}
                message={m}
                isOwn={!!currentUserId && m.sender?.id === currentUserId}
              />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {isChat && <Composer conversationId={conversation.id} />}
    </div>
  )
}
