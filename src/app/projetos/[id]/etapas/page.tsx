import { permanentRedirect } from 'next/navigation'

export default async function EtapasRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  permanentRedirect(`/projetos/${id}/cronograma?view=board`)
}
