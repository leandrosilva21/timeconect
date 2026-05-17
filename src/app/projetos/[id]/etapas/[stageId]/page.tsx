import { permanentRedirect } from 'next/navigation'

export default async function StageDetailRedirect({
  params,
}: {
  params: Promise<{ id: string; stageId: string }>
}) {
  const { id, stageId } = await params
  permanentRedirect(`/projetos/${id}/cronograma/${stageId}`)
}
