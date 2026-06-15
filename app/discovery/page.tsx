import { buildDiscoveryPageData } from '@/lib/discovery/discovery'

import { DiscoveryPageContent } from '@/components/discovery/discovery-page-content'

export const metadata = {
  title: 'Discovery — Morphic',
  description: 'Source-backed stories from configured feeds.'
}

export default async function DiscoveryPage() {
  const data = await buildDiscoveryPageData()

  return <DiscoveryPageContent data={data} />
}
