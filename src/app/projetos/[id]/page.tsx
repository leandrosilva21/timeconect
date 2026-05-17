'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ProjectIndexPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  useEffect(() => {
    router.replace(`/projetos/${params.id}/cronograma`)
  }, [params.id, router])

  return null
}
