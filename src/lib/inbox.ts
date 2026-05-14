import { api } from './api'
import type {
  ConversationSummary,
  InboxMessage,
  NotificationStatusValue,
  PaginatedMessages,
  PresenceEntry,
  PresenceStatusValue,
  UnreadSummary,
} from '@/types/inbox'

export function listConversations(): Promise<{ data: ConversationSummary[] }> {
  return api.get('/inbox/conversations')
}

export function listMessages(conversationId: number, perPage = 50): Promise<PaginatedMessages> {
  return api.get(`/inbox/conversations/${conversationId}/messages?per_page=${perPage}`)
}

export function sendMessage(
  conversationId: number,
  body: string,
  metadata?: Record<string, unknown>,
): Promise<{ data: InboxMessage }> {
  return api.post(`/inbox/conversations/${conversationId}/messages`, { body, metadata })
}

export function markRead(conversationId: number): Promise<{ marked_read: boolean }> {
  return api.post(`/inbox/conversations/${conversationId}/read`, {})
}

export function updateMessageStatus(
  messageId: number,
  status: NotificationStatusValue,
  snoozed_until?: string,
): Promise<{ data: { id: number; status: NotificationStatusValue; snoozed_until: string | null } }> {
  return api.patch(`/inbox/messages/${messageId}/status`, snoozed_until ? { status, snoozed_until } : { status })
}

export function unreadSummary(): Promise<UnreadSummary> {
  return api.get('/inbox/unread-summary')
}

export function presenceHeartbeat(status?: PresenceStatusValue): Promise<PresenceEntry> {
  return api.post('/presence/heartbeat', status ? { status } : {})
}

export function listPresence(userIds?: number[]): Promise<{ data: PresenceEntry[] }> {
  const q = userIds && userIds.length ? `?user_ids=${userIds.join(',')}` : ''
  return api.get(`/presence${q}`)
}
