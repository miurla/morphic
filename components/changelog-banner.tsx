'use client'

import { X } from 'lucide-react'

import { useChangelog } from '@/hooks/use-changelog'

import { IconLogo } from '@/components/ui/icons'

export function ChangelogBanner() {
  const { changelog, isVisible, dismiss } = useChangelog()

  if (!isVisible || !changelog) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 animate-in slide-in-from-bottom-5 duration-300">
      <div className="relative bg-background/95 backdrop-blur border rounded-lg shadow-sm p-3 pr-6 max-w-[300px]">
        <button
          onClick={dismiss}
          className="absolute -top-2 -right-2 bg-background border rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
          aria-label="Close"
        >
          <X className="h-3 w-3" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <IconLogo className="h-4 w-4" />
            <span className="text-xs px-1.5 py-0.5 bg-muted rounded-md font-mono">
              v{changelog.version}
            </span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {changelog.features.map((feature, index) => (
              <li key={index}>• {feature}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
