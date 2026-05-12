'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { ApprovalsScreen } from '@/components/screens/ApprovalsScreen'

export default function ApprovalsPage() {
  return (
    <AppLayout title="Aprovações">
      <ApprovalsScreen />
    </AppLayout>
  )
}
