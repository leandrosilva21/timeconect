'use client'

import { useApiQuery } from './use-query'
import type { StageAportesResponse } from '@/lib/types/stage-aporte'

export function useStageAportes(stageId: number | null) {
  const path = stageId ? `/stages/${stageId}/aportes` : null
  const { data, loading, error, refetch } = useApiQuery<StageAportesResponse>(path)
  return {
    items: data?.items ?? [],
    totals: data?.totals ?? { count: 0, hours: 0 },
    loading,
    error,
    refetch,
  }
}
