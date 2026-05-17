import type { ScheduleStage } from '@/hooks/use-project-schedule'

/**
 * Numeração hierárquica visual do Cronograma (Fase 7).
 *
 * Etapas viram 1, 2, 3... pela posição no array já ordenado por `order_index`.
 * Atividades viram 1.1, 1.2... pela posição dentro da etapa pai.
 * NÃO é id técnico nem chave — é índice operacional visual.
 *
 * Recalcula em todo render (pure function), espelhando sempre a ordem visual.
 */

export interface CronogramaCodes {
  stageCode: (stageId: number) => string
  activityCode: (deliveryId: number) => string
}

export function buildCronogramaCodes(stages: ScheduleStage[]): CronogramaCodes {
  const stageMap = new Map<number, string>()
  const activityMap = new Map<number, string>()

  stages.forEach((stage, sIdx) => {
    const stageCode = String(sIdx + 1)
    stageMap.set(stage.id, stageCode)

    const deliveries = stage.deliveries ?? []
    deliveries.forEach((delivery, dIdx) => {
      activityMap.set(delivery.id, `${stageCode}.${dIdx + 1}`)
    })
  })

  return {
    stageCode: (id: number) => stageMap.get(id) ?? '',
    activityCode: (id: number) => activityMap.get(id) ?? '',
  }
}
