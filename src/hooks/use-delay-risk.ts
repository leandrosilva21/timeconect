'use client'

import { useApiQuery } from './use-query'

export interface DelayRisk {
  project_end: string | null
  latest_stage_end: string | null
  delay_days: number
  has_risk: boolean
}

export function useDelayRisk(projectId: number | null | undefined) {
  const path = projectId ? `/projects/${projectId}/delay-risk` : null
  const { data, loading, error, refetch } = useApiQuery<DelayRisk>(path)
  return { data, loading, error, refetch }
}
