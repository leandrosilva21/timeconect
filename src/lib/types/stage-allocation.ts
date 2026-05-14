export type AllocationHealth = 'ok' | 'atencao' | 'estourado' | 'unknown'

export interface AllocationUser {
  id: number
  name: string
  email: string
}

export interface StageAllocationItem {
  id: number
  stage_id: number
  user_id: number
  user: AllocationUser | null
  planned_hours: number
  actual_hours: number
  remaining_hours: number
  health: AllocationHealth
}

export interface StageAllocationTotals {
  planned_hours: number
  actual_hours: number
  remaining_hours: number
  overrun_count: number
}

export interface StageAllocationsResponse {
  items: StageAllocationItem[]
  totals: StageAllocationTotals
}
