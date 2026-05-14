export type StageActivityType =
  | 'delivery_moved'
  | 'delivery_created'
  | 'delivery_completed'
  | 'hours_logged'
  | 'aporte_created'
  | 'block_set'
  | 'block_cleared'
  | 'comment'

export interface StageActivityActor {
  id: number
  name: string
  email?: string
}

export interface StageActivityEvent {
  id: number
  stage_id: number
  actor_user_id: number | null
  actor?: StageActivityActor | null
  type: StageActivityType
  payload: Record<string, unknown> | null
  created_at: string
}

export interface StageActivityResponse {
  items: StageActivityEvent[]
}
