import { api } from './api'
import type { BotAgent, BotGeneralConfig, BotProvider, BotRule, BotSkill } from '@/types/bot'

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

// Rules
export const listRules       = (): Promise<{ data: BotRule[] }>       => api.get('/bot/rules')
export const updateRule      = (id: number, payload: Partial<BotRule>) => api.put<{ data: BotRule[] }>(`/bot/rules/${id}`, payload)
