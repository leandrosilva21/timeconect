export interface BotProvider {
  id: number
  slug: string
  name: string
  api_key_env: string
  has_key: boolean
  base_url: string | null
  default_model: string
  enabled: boolean
}

export interface BotAgent {
  id: number
  slug: string
  name: string
  role_description: string | null
  system_prompt: string
  model_override: string | null
  temperature_override: number | null
  active: boolean
  priority: number
  min_severity: string
  cooldown_minutes: number
  max_per_day: number
  trigger_conditions: Record<string, unknown> | null
}

export interface BotSkill {
  id: number
  slug: string
  name: string
  description: string | null
  rule_type: 'threshold' | 'sql' | 'event'
  config: Record<string, unknown>
  severity: string
  active: boolean
}

export interface BotRule {
  id: number
  name: string
  trigger_event: string
  severity_min: string
  target_type: 'user' | 'role' | 'customer_team' | 'all_admins'
  target_value: string | null
  channel: 'inbox' | 'teams' | 'email'
  active: boolean
}

export interface BotGeneralConfig {
  id: number
  active_provider: { id: number; slug: string; name: string } | null
  default_model: string | null
  temperature: number
  frequency_cron: string
  active_hours_start: string | null
  active_hours_end: string | null
  default_severity_threshold: string
  cooldown_minutes: number
  dedupe_window_minutes: number
}
