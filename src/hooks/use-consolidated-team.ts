'use client'

import { useApiQuery } from './use-query'

export interface ConsolidatedTeamStage {
  stage_id: number
  stage_name: string
  planned: number
  actual: number
}

export interface ConsolidatedTeamRow {
  user: { id: number; name: string; email: string }
  total_planned: number
  total_actual: number
  total_remaining: number
  stages: ConsolidatedTeamStage[]
}

export interface ConsolidatedTeamResponse {
  items: ConsolidatedTeamRow[]
  is_operational: boolean
  totals: {
    consultant_count: number
    total_planned: number
    total_actual: number
  }
}

export function useConsolidatedTeam(projectId: number | null | undefined) {
  const path = projectId ? `/projects/${projectId}/consolidated-team` : null
  const { data, loading, error, refetch } = useApiQuery<ConsolidatedTeamResponse>(path)
  return {
    items: data?.items ?? [],
    isOperational: data?.is_operational ?? false,
    totals: data?.totals ?? { consultant_count: 0, total_planned: 0, total_actual: 0 },
    loading,
    error,
    refetch,
  }
}
