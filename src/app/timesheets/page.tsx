'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { TimesheetsScreen } from '@/components/screens/TimesheetsScreen'

export default function TimesheetsPage() {
  return (
    <AppLayout title="Apontamentos">
      <TimesheetsScreen />
    </AppLayout>
  )
}
