'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { ExpensesScreen } from '@/components/screens/ExpensesScreen'

export default function ExpensesPage() {
  return (
    <AppLayout title="Despesas">
      <ExpensesScreen />
    </AppLayout>
  )
}
