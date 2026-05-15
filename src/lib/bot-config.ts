import { api } from './api'
import type {
  BotAgent, BotGeneralConfig, BotProvider, BotRule, BotSkill,
  RuleOptions, RuleTestPreview,
} from '@/types/bot'
import type { ChatUser } from '@/types/inbox'

// General
export const getBotConfig    = (): Promise<{ data: BotGeneralConfig }> => api.get('/bot/config')
export const updateBotConfig = (payload: Partial<BotGeneralConfig> & { active_provider_id?: number }) => api.put<{ data: BotGeneralConfig }>('/bot/config', payload)

// Providers
export const listProviders   = (): Promise<{ data: BotProvider[] }>   => api.get('/bot/providers')
export const updateProvider  = (id: number, payload: Partial<BotProvider>) => api.put<{ data: BotProvider[] }>(`/bot/providers/${id}`, payload)

// Agents
export const listAgents      = (): Promise<{ data: BotAgent[] }>      => api.get('/bot/agents')
export const updateAgent     = (id: number, payload: Partial<BotAgent>) => api.put<{ data: BotAgent[] }>(`/bot/agents/${id}`, payload)

// Skills
export const listSkills      = (): Promise<{ data: BotSkill[] }>      => api.get('/bot/skills')
export const updateSkill     = (id: number, payload: Partial<BotSkill>) => api.put<{ data: BotSkill[] }>(`/bot/skills/${id}`, payload)

// Rules — CRUD completo
export const listRules       = (): Promise<{ data: BotRule[] }>       => api.get('/bot/rules')
export const getRuleOptions  = (): Promise<{ data: RuleOptions }>     => api.get('/bot/rules/options')
export const createRule      = (payload: Partial<BotRule>): Promise<{ data: BotRule }> => api.post('/bot/rules', payload)
export const updateRule      = (id: number, payload: Partial<BotRule>): Promise<{ data: BotRule }> => api.put(`/bot/rules/${id}`, payload)
export const deleteRule      = (id: number): Promise<{ deleted: boolean }> => api.delete(`/bot/rules/${id}`)
export const testRule        = (id: number, feedId?: number): Promise<{ data: RuleTestPreview }> => api.post(`/bot/rules/${id}/test`, feedId ? { feed_id: feedId } : {})
export const listChatUsersForRule = (): Promise<{ data: ChatUser[] }> => api.get('/conversations/users')
