'use client'

import type { ComponentFn } from '@json-render/react'

import { captureClient, chatIdFromPath } from '@/lib/analytics/posthog-client'
import { displayUrlName } from '@/lib/utils/domain'
import { faviconUrl } from '@/lib/utils/favicon'

import type { CatalogType } from './shared'

function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

const cardClass = 'flex h-full min-w-0 flex-col gap-1 rounded-lg border p-3'

export const Card: ComponentFn<CatalogType, 'Card'> = ({ props, children }) => {
  const { href } = props

  // Only real web links make a card clickable. A javascript: or relative URL,
  // or the prompt's EXAMPLE_ placeholders if a model copies them, renders as a
  // plain card instead.
  if (!href || !isWebUrl(href)) {
    return <div className={cardClass}>{children}</div>
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        captureClient('genui_component_clicked', {
          type: 'card',
          chatId:
            typeof window === 'undefined'
              ? undefined
              : chatIdFromPath(window.location.pathname)
        })
      }
      className={`${cardClass} transition-colors hover:bg-muted/50`}
    >
      {children}
      <span className="mt-auto flex min-w-0 items-center gap-1.5 pt-1 text-xs text-muted-foreground">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={faviconUrl(href)}
          alt=""
          className="size-3.5 shrink-0 rounded-sm"
        />
        <span className="truncate">{displayUrlName(href)}</span>
      </span>
    </a>
  )
}
