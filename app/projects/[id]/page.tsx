import { notFound } from 'next/navigation'

import { getProjectWithChats } from '@/lib/actions/project'

import { ProjectDetailClient } from './project-detail-client'

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getProjectWithChats(id)
  return {
    title: result
      ? `${result.project.name} | Borsatti's`
      : "Projects | Borsatti's"
  }
}

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getProjectWithChats(id)
  if (!result) notFound()
  return <ProjectDetailClient project={result.project} chats={result.chats} />
}
