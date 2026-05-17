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

export interface ProjectCoordinator {
  id: number
  name: string
  email: string | null
}

export interface ScheduleResponse {
  is_operational: boolean
  project_window: ProjectWindow | null
  /** Feriados ativos dentro da janela do cronograma (YYYY-MM-DD). ADR 0009 appendix. */
  holidays?: string[]
  project: {
    id: number
    name: string
    sold_hours: number
    start_date: string | null
    expected_end_date: string | null
    coordinators?: ProjectCoordinator[]
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
    holidays: data?.holidays ?? [],
    loading,
    error,
    refetch,
  }
}
