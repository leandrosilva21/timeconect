'use client'

import { useApiQuery } from './use-query'
import type { StageActivityResponse } from '@/lib/types/stage-activity'

export function useStageActivity(stageId: number | null, limit = 50) {
  const path = stageId ? `/stages/${stageId}/activity?limit=${limit}` : null
  const { data, loading, error, refetch } = useApiQuery<StageActivityResponse>(path)
  return {
    items: data?.items ?? [],
    loading,
    error,
    refetch,
  }
}
