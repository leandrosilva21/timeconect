'use client'

import { useApiQuery } from './use-query'
import type { StageAllocationsResponse } from '@/lib/types/stage-allocation'

export function useStageAllocations(stageId: number | null) {
  const path = stageId ? `/stages/${stageId}/allocations` : null
  const { data, loading, error, refetch } = useApiQuery<StageAllocationsResponse>(path)
  return {
    items: data?.items ?? [],
    totals: data?.totals ?? { planned_hours: 0, actual_hours: 0, remaining_hours: 0, overrun_count: 0 },
    loading, error, refetch,
  }
}
