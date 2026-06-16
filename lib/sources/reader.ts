import { HTMLElement, parse } from 'node-html-parser'

import {
  canonicalizeSourceUrl,
  extractSourceDomain,
  normalizeSourceText
} from './source-metadata'

const MAX_METADATA_LENGTH = 1024
const MAX_READER_CONTENT_LENGTH = 30000

export interface NormalizedReaderRequest {
  url: string
  title?: string
  siteName?: string
  sourceId?: string
  domain: string
}

export interface ReaderContent {
  title: string
  content: string
  sourceUrl: string
  domain: string
  excerpt?: string
}

function trimMetadata(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  return normalizeSourceText(value.slice(0, MAX_METADATA_LENGTH))
}

export function normalizeReaderRequest(
  value: unknown
): NormalizedReaderRequest | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const input = value as {
    url?: unknown
    title?: unknown
    siteName?: unknown
    sourceId?: unknown
  }

  if (typeof input.url !== 'string') {
    return null
  }

  const url = canonicalizeSourceUrl(input.url)
  if (!url) {
    return null
  }

  const domain = extractSourceDomain(url)
  if (!domain) {
    return null
  }

  return {
    url,
    domain,
    title: trimMetadata(input.title),
    siteName: trimMetadata(input.siteName),
    sourceId: trimMetadata(input.sourceId)
  }
}

function removeNoise(root: HTMLElement) {
  for (const selector of [
    'script',
    'style',
    'noscript',
    'svg',
    'iframe',
    'form',
    'button',
    'input',
    'select',
    'textarea',
    'nav',
    'aside',
    'footer',
    'header'
  ]) {
    for (const element of root.querySelectorAll(selector)) {
      element.remove()
    }
  }
}

function getTitle(root: HTMLElement, readableRoot: HTMLElement, url: string) {
  const heading =
    normalizeSourceText(readableRoot.querySelector('h1')?.textContent) ??
    normalizeSourceText(root.querySelector('h1')?.textContent) ??
    normalizeSourceText(root.querySelector('title')?.textContent)

  return heading ?? new URL(url).hostname
}

function getReadableRoot(root: HTMLElement) {
  return (
    root.querySelector('article') ??
    root.querySelector('main') ??
    root.querySelector('[role="main"]') ??
    root.querySelector('body') ??
    root
  )
}

function normalizeReadableText(value: string): string {
  return value
    .replace(/\r/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ *\n */g, '\n')
    .trim()
}

export function extractReadableText(
  html: string,
  sourceUrl: string
): ReaderContent {
  const root = parse(html, {
    blockTextElements: {
      script: false,
      style: false,
      pre: true
    }
  })
  removeNoise(root)

  const readableRoot = getReadableRoot(root)
  const title = getTitle(root, readableRoot, sourceUrl)
  const content = normalizeReadableText(readableRoot.structuredText)
  const domain = extractSourceDomain(sourceUrl) ?? new URL(sourceUrl).hostname
  const limitedContent =
    content.length > MAX_READER_CONTENT_LENGTH
      ? `${content.slice(0, MAX_READER_CONTENT_LENGTH)}...[truncated]`
      : content

  return {
    title,
    content: limitedContent,
    sourceUrl,
    domain,
    excerpt: limitedContent.slice(0, 500)
  }
}

export function isReaderSupportedContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase()
  return (
    normalized.includes('text/html') ||
    normalized.includes('text/plain') ||
    normalized.includes('application/xhtml+xml')
  )
}

export function buildReaderUrl({
  url,
  title,
  siteName,
  sourceId
}: {
  url: string
  title?: string | null
  siteName?: string | null
  sourceId?: string | null
}) {
  const params = new URLSearchParams({ url })
  if (title) params.set('title', title)
  if (siteName) params.set('siteName', siteName)
  if (sourceId) params.set('sourceId', sourceId)
  return `/reader?${params.toString()}`
}
