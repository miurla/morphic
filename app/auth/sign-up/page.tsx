import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

function withAuthParam(path: string, mode: 'signin' | 'signup') {
  const url = new URL(path, 'http://localhost')
  url.searchParams.set('auth', mode)
  return `${url.pathname}${url.search}`
}

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const headerStore = await headers()
  const referer = headerStore.get('referer')
  const fallbackPath = referer ? new URL(referer).pathname : '/'

  redirect(withAuthParam(next || fallbackPath, 'signup'))
}
