'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { AuditoriaApontamentosScreen } from '@/components/screens/AuditoriaApontamentosScreen'

export default function AuditoriaApontamentosPage() {
  return (
    <AppLayout title="Auditoria de Apontamentos">
      <AuditoriaApontamentosScreen />
    </AppLayout>
  )
}
