'use client'

import { useApiQuery } from './use-query'
import type { StageAllocationsResponse } from '@/lib/types/stage-allocation'

export function useActivityAllocations(deliveryId: number | null | undefined) {
  const path = deliveryId ? `/activities/${deliveryId}/allocations` : null
  const { data, loading, error, refetch } = useApiQuery<StageAllocationsResponse>(path)
  return {
    items: data?.items ?? [],
    totals: data?.totals ?? { planned_hours: 0, actual_hours: 0, remaining_hours: 0, overrun_count: 0 },
    loading,
    error,
    refetch,
  }
}
