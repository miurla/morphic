import { redirect } from 'next/navigation'

import { getCurrentUserId } from '@/lib/auth/get-current-user'

import { TutorWorkspace } from '@/components/tutor/tutor-workspace'

export const metadata = { title: 'Tutor · Morphic' }

export default async function TutorPage({
  searchParams
}: {
  searchParams: Promise<{ course?: string }>
}) {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/auth/login')
  const { course } = await searchParams
  return (
    <TutorWorkspace
      userId={userId}
      initialCourseId={typeof course === 'string' ? course : undefined}
    />
  )
}
