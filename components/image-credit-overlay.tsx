/* eslint-disable @next/next/no-img-element */
'use client'

import { displayUrlName } from '@/lib/utils/domain'

/**
 * Normalize a user- or model-supplied URL to a safe http(s) URL, or return
 * null if the scheme is not allowed. Prevents XSS via javascript:/data: URLs
 * embedded in model-generated spec blocks.
 */
const sanitizeHttpUrl = (raw: string | undefined): string | null => {
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}

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
  const safeLink = sanitizeHttpUrl(sourceUrl) ?? sanitizeHttpUrl(url)
  const label = title || description

  const content = (
    <>
      {safeLink && (
        <img
          src={getFaviconUrl(safeLink)}
          alt=""
          className="size-7 rounded-lg shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        {safeLink && (
          <div className="text-white/70 text-xs">
            {displayUrlName(safeLink)}
          </div>
        )}
        {label && (
          <div className="text-white text-sm font-medium line-clamp-1">
            {label}
          </div>
        )}
      </div>
    </>
  )

  const className =
    'absolute bottom-3 left-3 max-w-[80%] bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2.5 flex items-center gap-2.5 no-underline hover:bg-black/80 transition-colors'

  if (!safeLink) {
    // Untrusted or missing URL: render a non-clickable label instead of an <a>.
    return <div className={className}>{content}</div>
  }

  return (
    <a
      href={safeLink}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={e => e.stopPropagation()}
    >
      {content}
    </a>
  )
}
