'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const TABS = [
  { id: 'for-you', label: 'For You' },
  { id: 'top-stories', label: 'Top Stories' },
  { id: 'tech-science', label: 'Tech & Science' },
  { id: 'business', label: 'Business' }
]

export function DiscoverTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('category') || 'for-you'

  function handleTabChange(tabId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('category', tabId)
    router.push(`/discover?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border pb-0 scrollbar-hide">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
