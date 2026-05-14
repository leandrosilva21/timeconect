export interface StageAporteUser {
  id: number
  name: string
  email?: string
}

export interface StageAporte {
  id: number
  stage_id: number
  user_id: number | null
  user?: StageAporteUser | null
  hours: number
  reason: string
  created_at: string
}

export interface StageAportesResponse {
  items: StageAporte[]
  totals: {
    count: number
    hours: number
  }
}
