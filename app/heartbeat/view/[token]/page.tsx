import { HeartbeatViewPage } from '@/components/heartbeat/heartbeat-view-page'

export default async function Page({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <HeartbeatViewPage token={token} />
}
