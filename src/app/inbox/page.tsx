'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/app-layout'
import { listConversations, presenceHeartbeat, unreadSummary } from '@/lib/inbox'
import { ConversationsSidebar } from '@/components/inbox/ConversationsSidebar'
import { InboxHeader } from '@/components/inbox/InboxHeader'
import { MessageList } from '@/components/inbox/MessageList'
import { SeveritySummary } from '@/components/inbox/SeveritySummary'

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: convData, isLoading } = useQuery({
    queryKey: ['inbox-conversations'],
    queryFn: listConversations,
    refetchInterval: 30_000,
  })

  const { data: summary } = useQuery({
    queryKey: ['inbox-summary'],
    queryFn: unreadSummary,
    refetchInterval: 30_000,
  })

  const conversations = convData?.data ?? []

  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id)
    }
  }, [conversations, selectedId])

  useEffect(() => {
    presenceHeartbeat('online').catch(() => {})
    const t = setInterval(() => presenceHeartbeat('online').catch(() => {}), 120_000)
    return () => clearInterval(t)
  }, [])

  const selectedConv = conversations.find(c => c.id === selectedId) ?? null

  const summaryBreakdown = summary
    ? { ...summary.by_severity, total: summary.total_unread }
    : undefined

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3.5rem)] flex bg-zinc-950">
        <ConversationsSidebar
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={isLoading}
        />
        <div className="flex-1 flex flex-col">
          <InboxHeader conversation={selectedConv} />
          <SeveritySummary bySeverity={summaryBreakdown} />
          <MessageList conversationId={selectedId} />
        </div>
      </div>
    </AppLayout>
  )
}
