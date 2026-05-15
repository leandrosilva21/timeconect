'use client'

import { useApiQuery } from './use-query'
import type { ProjectStage, StageDelivery } from '@/lib/types/project-stage'

export interface ScheduleStage extends ProjectStage {
  deliveries: StageDelivery[]
}

export interface ProjectWindow {
  start: string | null
  end: string | null
}

export interface ScheduleResponse {
  is_operational: boolean
  project_window: ProjectWindow | null
  project: {
    id: number
    name: string
    sold_hours: number
    start_date: string | null
    expected_end_date: string | null
  } | null
  stages: ScheduleStage[]
}

export function useProjectSchedule(projectId: number | null | undefined) {
  const path = projectId ? `/projects/${projectId}/schedule` : null
  const { data, loading, error, refetch } = useApiQuery<ScheduleResponse>(path)
  return {
    isOperational: data?.is_operational ?? true,
    projectWindow: data?.project_window ?? null,
    project: data?.project ?? null,
    stages: data?.stages ?? [],
    loading,
    error,
    refetch,
  }
}
