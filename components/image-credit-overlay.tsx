/* eslint-disable @next/next/no-img-element */
'use client'

import { displayUrlName } from '@/lib/utils/domain'

export const getFaviconUrl = (imageUrl: string): string => {
  try {
    const hostname = new URL(imageUrl).hostname
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`
  } catch {
    return ''
  }
}

type ImageCreditOverlayProps = {
  /** Fallback link URL (e.g. the image URL itself). Used when sourceUrl is not set. */
  url: string
  /** Original referring page URL; preferred for link/favicon/hostname when present. */
  sourceUrl?: string
  title?: string
  description?: string
}

export function ImageCreditOverlay({
  url,
  sourceUrl,
  title,
  description
}: ImageCreditOverlayProps) {
  const linkUrl = sourceUrl || url
  const label = title || description
  return (
    <a
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute bottom-3 left-3 max-w-[80%] bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2.5 flex items-center gap-2.5 no-underline hover:bg-black/80 transition-colors"
      onClick={e => e.stopPropagation()}
    >
      <img
        src={getFaviconUrl(linkUrl)}
        alt=""
        className="size-7 rounded-lg shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="text-white/70 text-xs">{displayUrlName(linkUrl)}</div>
        {label && (
          <div className="text-white text-sm font-medium line-clamp-1">
            {label}
          </div>
        )}
      </div>
    </a>
  )
}
