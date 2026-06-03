'use client'

import { useApiQuery } from './use-query'

export interface MyCard {
  id: number
  title: string
  priority: 'low' | 'medium' | 'high'
  status: 'backlog' | 'in_progress' | 'waiting_client' | 'review' | 'done'
  due_date: string | null
  hours_planned: number
  stage_id: number
  stage_name: string
  project_id: number
  project_name: string
  customer_name: string | null
}

export type MyCardsSection = 'overdue' | 'waiting_client' | 'in_progress' | 'backlog'

interface Response {
  sections: Record<MyCardsSection, MyCard[]>
  totals: Record<MyCardsSection, number>
}

export function useMyCards() {
  const { data, loading, error, refetch } = useApiQuery<Response>('/me/cards')
  return {
    sections: data?.sections ?? { overdue: [], waiting_client: [], in_progress: [], backlog: [] },
    totals: data?.totals ?? { overdue: 0, waiting_client: 0, in_progress: 0, backlog: 0 },
    loading,
    error,
    refetch,
  }
}
