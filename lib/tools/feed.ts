import { tool, UIToolInvocation } from 'ai'
import { XMLParser } from 'fast-xml-parser'
import { parse } from 'node-html-parser'

import { feedSchema } from '@/lib/schema/feed'
import {
  FeedDiscoveryResult,
  FeedFormat,
  FeedItem,
  FeedSearchResults,
  ParsedFeed,
  PodcastMetadata,
  PodcastValueRecipient
} from '@/lib/types/feed'

const FEEDSEARCH_API_URL = 'https://feedsearch.dev/api/v1/search'
const FEEDSEARCH_ATTRIBUTION = {
  label: 'powered by Feedsearch',
  url: 'https://feedsearch.dev'
}
const USER_AGENT = 'Morphic/1.0 (+https://github.com/miurla/morphic)'
const FEED_ACCEPT_HEADER = [
  'application/feed+json',
  'application/json',
  'application/rss+xml',
  'application/atom+xml',
  'application/rdf+xml',
  'application/xml;q=0.9',
  'text/xml;q=0.8',
  'text/html;q=0.7',
  '*/*;q=0.5'
].join(', ')

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '#text',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: name =>
    [
      'item',
      'entry',
      'link',
      'enclosure',
      'category',
      'podcast:funding',
      'podcast:person',
      'podcast:valueRecipient',
      'podcast:transcript',
      'podcast:soundbite',
      'itunes:category'
    ].includes(name)
})

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function textValue(value: any): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'object') {
    return textValue(value['#text']) ?? textValue(value._)
  }
  return undefined
}

function attrValue(value: any, attr: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  return textValue(value[`@_${attr}`])
}

function firstText(...values: any[]): string | undefined {
  for (const value of values) {
    const text = textValue(value)
    if (text) return text
  }
  return undefined
}

function stripMarkup(value?: string): string | undefined {
  if (!value) return undefined
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveUrl(url: string, baseUrl?: string): string {
  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return url
  }
}

function withDefaultScheme(url: string): string {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(url) ? url : `https://${url}`
}

function detectFeedFormatFromVersion(version?: string): FeedFormat {
  const normalized = version?.toLowerCase() ?? ''
  if (normalized.includes('jsonfeed')) return 'json'
  if (normalized.includes('atom')) return 'atom'
  if (normalized.includes('rdf') || normalized.includes('rss 1') || normalized === '1.0') return 'rss1'
  if (normalized.includes('rss') || normalized === '2.0') return 'rss2'
  return 'unknown'
}

function detectFeedFormat(parsed: any, contentType?: string): FeedFormat {
  const type = contentType?.toLowerCase() ?? ''
  if (type.includes('json')) return 'json'
  if (parsed?.rss) return 'rss2'
  if (parsed?.feed) return 'atom'
  if (parsed?.['rdf:RDF'] || parsed?.RDF) return 'rss1'
  return 'unknown'
}

async function fetchText(url: string): Promise<{
  body: string
  contentType: string
  finalUrl: string
}> {
  const response = await fetch(withDefaultScheme(url), {
    headers: {
      Accept: FEED_ACCEPT_HEADER,
      'User-Agent': USER_AGENT
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return {
    body: await response.text(),
    contentType: response.headers.get('content-type') ?? '',
    finalUrl: response.url || url
  }
}

function normalizeFeedsearchResult(item: any): FeedDiscoveryResult | null {
  const url = textValue(item?.url)
  if (!url) return null

  return {
    title: textValue(item?.title),
    description: textValue(item?.description),
    url,
    siteName: textValue(item?.site_name),
    siteUrl: textValue(item?.site_url),
    selfUrl: textValue(item?.self_url),
    favicon: textValue(item?.favicon),
    contentType: textValue(item?.content_type),
    version: textValue(item?.version),
    format: detectFeedFormatFromVersion(textValue(item?.version)),
    itemCount:
      typeof item?.item_count === 'number' ? item.item_count : undefined,
    lastSeen: textValue(item?.last_seen),
    lastUpdated: textValue(item?.last_updated),
    velocity: typeof item?.velocity === 'number' ? item.velocity : undefined,
    score: typeof item?.score === 'number' ? item.score : undefined,
    isPodcast: Boolean(item?.is_podcast),
    isPush: Boolean(item?.is_push),
    hubs: Array.isArray(item?.hubs) ? item.hubs.filter(Boolean) : undefined,
    source: 'feedsearch.dev'
  }
}

async function discoverWithFeedsearch(
  url: string
): Promise<FeedDiscoveryResult[]> {
  const apiUrl = new URL(FEEDSEARCH_API_URL)
  apiUrl.searchParams.set('url', url)
  apiUrl.searchParams.set('info', 'true')
  apiUrl.searchParams.set('favicon', 'false')
  apiUrl.searchParams.set('opml', 'false')

  const response = await fetch(apiUrl.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT
    }
  })

  if (!response.ok) {
    throw new Error(`Feedsearch failed: HTTP ${response.status}`)
  }

  const json = await response.json()
  if (!Array.isArray(json)) return []

  return json
    .map(normalizeFeedsearchResult)
    .filter((item): item is FeedDiscoveryResult => item !== null)
}

function discoverFromHtml(
  html: string,
  pageUrl: string
): FeedDiscoveryResult[] {
  const root = parse(html)
  const links = root.querySelectorAll('link')
  const feedTypes = new Set([
    'application/rss+xml',
    'application/atom+xml',
    'application/rdf+xml',
    'application/feed+json',
    'application/json'
  ])

  return links
    .map(link => {
      const rel = link.getAttribute('rel')?.toLowerCase() ?? ''
      const type = link.getAttribute('type')?.toLowerCase() ?? ''
      const href = link.getAttribute('href')
      if (!href || !rel.split(/\s+/).includes('alternate')) return null
      if (!feedTypes.has(type)) return null

      const title = link.getAttribute('title') ?? undefined
      const result: FeedDiscoveryResult = {
        title,
        url: resolveUrl(href, pageUrl),
        siteUrl: pageUrl,
        contentType: type,
        format: type.includes('atom')
          ? 'atom'
          : type.includes('json')
            ? 'json'
            : type.includes('rdf')
              ? 'rss1'
              : 'rss2',
        source: 'html-autodiscovery' as const
      }
      return result
    })
    .filter((item): item is FeedDiscoveryResult => item !== null)
}

function dedupeFeeds(feeds: FeedDiscoveryResult[]): FeedDiscoveryResult[] {
  const seen = new Set<string>()
  const deduped: FeedDiscoveryResult[] = []
  for (const feed of feeds) {
    const key = feed.url.replace(/\/+$/, '')
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(feed)
  }
  return deduped
}

function parseBoolean(value: any): boolean | undefined {
  const text = textValue(value)?.toLowerCase()
  if (!text) return undefined
  if (['yes', 'true', '1'].includes(text)) return true
  if (['no', 'false', '0'].includes(text)) return false
  return undefined
}

function parseNumber(value: any): number | undefined {
  const text = textValue(value)
  if (!text) return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

function collectItunesCategories(categories: any[]): string[] {
  const names = new Set<string>()
  const visit = (category: any) => {
    const text = attrValue(category, 'text') ?? textValue(category)
    if (text) names.add(text)
    asArray(category?.['itunes:category']).forEach(visit)
  }
  categories.forEach(visit)
  return Array.from(names)
}

function parsePodcastValue(valueNode: any): PodcastMetadata['value'] {
  if (!valueNode) return undefined
  const recipients: PodcastValueRecipient[] = asArray(
    valueNode['podcast:valueRecipient']
  ).map(recipient => ({
    name: attrValue(recipient, 'name'),
    type: attrValue(recipient, 'type'),
    address: attrValue(recipient, 'address'),
    split: parseNumber(attrValue(recipient, 'split')),
    customKey: attrValue(recipient, 'customKey'),
    customValue: attrValue(recipient, 'customValue')
  }))

  return {
    type: attrValue(valueNode, 'type'),
    method: attrValue(valueNode, 'method'),
    suggested: attrValue(valueNode, 'suggested'),
    recipients
  }
}

function parsePodcastMetadata(node: any): PodcastMetadata | undefined {
  if (!node) return undefined

  const funding = asArray(node['podcast:funding']).map(item => ({
    url: attrValue(item, 'url'),
    message: textValue(item)
  }))
  const people = asArray(node['podcast:person'])
    .map(person => ({
      name: textValue(person) ?? attrValue(person, 'name') ?? '',
      role: attrValue(person, 'role'),
      group: attrValue(person, 'group'),
      href: attrValue(person, 'href'),
      img: attrValue(person, 'img')
    }))
    .filter(person => person.name)
  const transcripts = asArray(node['podcast:transcript'])
    .map(item => ({
      url: attrValue(item, 'url') ?? '',
      type: attrValue(item, 'type'),
      language: attrValue(item, 'language'),
      rel: attrValue(item, 'rel')
    }))
    .filter(item => item.url)
  const soundbites = asArray(node['podcast:soundbite']).map(item => ({
    startTime: parseNumber(attrValue(item, 'startTime')),
    duration: parseNumber(attrValue(item, 'duration')),
    title: textValue(item)
  }))
  const locked = node['podcast:locked']
    ? {
        value: parseBoolean(node['podcast:locked']) ?? false,
        owner: attrValue(node['podcast:locked'], 'owner')
      }
    : undefined
  const chaptersNode = node['podcast:chapters']
  const image =
    attrValue(node['itunes:image'], 'href') ??
    attrValue(node.image, 'href') ??
    firstText(node.image?.url, node.image)

  const metadata: PodcastMetadata = {
    guid: firstText(node['podcast:guid'], node.guid),
    medium: firstText(node['podcast:medium']),
    locked,
    funding: funding.length > 0 ? funding : undefined,
    value: parsePodcastValue(node['podcast:value']),
    people: people.length > 0 ? people : undefined,
    location: firstText(node['podcast:location']),
    transcripts: transcripts.length > 0 ? transcripts : undefined,
    chapters: chaptersNode
      ? {
          url: attrValue(chaptersNode, 'url') ?? '',
          type: attrValue(chaptersNode, 'type')
        }
      : undefined,
    soundbites: soundbites.length > 0 ? soundbites : undefined,
    season: firstText(node['itunes:season']),
    episode: firstText(node['itunes:episode']),
    episodeType: firstText(node['itunes:episodeType']),
    explicit: parseBoolean(node['itunes:explicit']),
    image,
    categories: collectItunesCategories(asArray(node['itunes:category']))
  }

  const hasMetadata = Object.values(metadata).some(value =>
    Array.isArray(value) ? value.length > 0 : value !== undefined
  )
  return hasMetadata ? metadata : undefined
}

function rssLink(item: any, baseUrl: string): string | undefined {
  const rawLink = firstText(item.link, attrValue(item.link, 'href'))
  return rawLink ? resolveUrl(rawLink, baseUrl) : undefined
}

function atomLink(entry: any, baseUrl: string): string | undefined {
  const alternate =
    asArray(entry.link).find(link => attrValue(link, 'rel') === 'alternate') ??
    asArray(entry.link)[0]
  const rawLink = attrValue(alternate, 'href') ?? textValue(alternate)
  return rawLink ? resolveUrl(rawLink, baseUrl) : undefined
}

function parseEnclosures(item: any): FeedItem['enclosures'] {
  const enclosures = [
    ...asArray(item.enclosure),
    ...asArray(item.link).filter(link => attrValue(link, 'rel') === 'enclosure')
  ]

  return enclosures
    .map(enclosure => ({
      url: attrValue(enclosure, 'url') ?? attrValue(enclosure, 'href') ?? '',
      type: attrValue(enclosure, 'type'),
      length: attrValue(enclosure, 'length')
    }))
    .filter(enclosure => enclosure.url)
}

function parseRssFeed(
  parsed: any,
  url: string,
  format: FeedFormat
): ParsedFeed {
  const channel =
    parsed.rss?.channel ?? parsed['rdf:RDF']?.channel ?? parsed.RDF?.channel
  const items = asArray(
    parsed.rss?.channel?.item ?? parsed['rdf:RDF']?.item ?? parsed.RDF?.item
  )
  const podcast = parsePodcastMetadata(channel)

  return {
    title: firstText(channel?.title),
    description: stripMarkup(firstText(channel?.description)),
    url,
    siteUrl: firstText(channel?.link),
    format,
    version:
      attrValue(parsed.rss, 'version') ??
      (format === 'rss1' ? '1.0' : '2.0'),
    language: firstText(channel?.language),
    image:
      attrValue(channel?.['itunes:image'], 'href') ??
      firstText(channel?.image?.url),
    isPodcast: Boolean(
      podcast || items.some(item => parseEnclosures(item)?.length)
    ),
    podcast,
    items: items.map(item => ({
      id: firstText(item.guid, item['dc:identifier']),
      title: firstText(item.title) ?? 'Untitled item',
      url: rssLink(item, url),
      content: stripMarkup(
        firstText(item['content:encoded'], item.description)
      ),
      summary: stripMarkup(firstText(item.description)),
      author: firstText(item.author, item['dc:creator'], item['itunes:author']),
      published: firstText(item.pubDate, item['dc:date']),
      updated: firstText(item.updated),
      enclosures: parseEnclosures(item),
      podcast: parsePodcastMetadata(item)
    }))
  }
}

function parseAtomFeed(parsed: any, url: string): ParsedFeed {
  const feed = parsed.feed
  const entries = asArray(feed?.entry)
  const podcast = parsePodcastMetadata(feed)

  return {
    title: firstText(feed?.title),
    description: stripMarkup(firstText(feed?.subtitle, feed?.summary)),
    url,
    siteUrl: atomLink(feed, url),
    format: 'atom',
    version: attrValue(feed, 'version') ?? 'atom',
    language: attrValue(feed, 'lang') ?? attrValue(feed, 'xml:lang'),
    image: firstText(feed?.logo, feed?.icon),
    isPodcast: Boolean(
      podcast || entries.some(entry => parseEnclosures(entry)?.length)
    ),
    podcast,
    items: entries.map(entry => ({
      id: firstText(entry.id),
      title: firstText(entry.title) ?? 'Untitled entry',
      url: atomLink(entry, url),
      content: stripMarkup(firstText(entry.content, entry.summary)),
      summary: stripMarkup(firstText(entry.summary)),
      author: firstText(entry.author?.name, entry.author),
      published: firstText(entry.published),
      updated: firstText(entry.updated),
      enclosures: parseEnclosures(entry),
      podcast: parsePodcastMetadata(entry)
    }))
  }
}

function parseJsonFeed(json: any, url: string): ParsedFeed {
  const items = Array.isArray(json.items) ? json.items : []
  return {
    title: textValue(json.title),
    description: stripMarkup(textValue(json.description)),
    url,
    siteUrl: textValue(json.home_page_url),
    format: 'json',
    version: textValue(json.version),
    language: textValue(json.language),
    image: textValue(json.icon) ?? textValue(json.favicon),
    isPodcast: items.some((item: any) => Array.isArray(item.attachments)),
    podcast: undefined,
    items: items.map((item: any) => ({
      id: textValue(item.id),
      title: textValue(item.title) ?? textValue(item.id) ?? 'Untitled item',
      url: textValue(item.url) ?? textValue(item.external_url),
      content: stripMarkup(
        textValue(item.content_html) ?? textValue(item.content_text)
      ),
      summary: stripMarkup(textValue(item.summary)),
      author:
        textValue(item.author?.name) ?? textValue(item.authors?.[0]?.name),
      published: textValue(item.date_published),
      updated: textValue(item.date_modified),
      enclosures: Array.isArray(item.attachments)
        ? item.attachments
            .map((attachment: any) => ({
              url: textValue(attachment.url) ?? '',
              type: textValue(attachment.mime_type),
              length: textValue(attachment.size_in_bytes)
            }))
            .filter((attachment: any) => attachment.url)
        : undefined
    }))
  }
}

function limitFeedItems(feed: ParsedFeed, maxItems: number): ParsedFeed {
  return {
    ...feed,
    items: feed.items.slice(0, maxItems)
  }
}

function omitPodcastMetadata(feed: ParsedFeed): ParsedFeed {
  return {
    ...feed,
    podcast: undefined,
    items: feed.items.map(item => ({
      ...item,
      podcast: undefined
    }))
  }
}

export async function parseFeedUrl(
  url: string,
  maxItems: number
): Promise<ParsedFeed> {
  const { body, contentType, finalUrl } = await fetchText(url)
  const trimmed = body.trim()

  if (contentType.toLowerCase().includes('json') || trimmed.startsWith('{')) {
    return limitFeedItems(
      parseJsonFeed(JSON.parse(trimmed), finalUrl),
      maxItems
    )
  }

  const parsed = xmlParser.parse(trimmed)
  const format = detectFeedFormat(parsed, contentType)
  if (format === 'rss2' || format === 'rss1') {
    return limitFeedItems(parseRssFeed(parsed, finalUrl, format), maxItems)
  }
  if (format === 'atom') {
    return limitFeedItems(parseAtomFeed(parsed, finalUrl), maxItems)
  }

  throw new Error('Unsupported feed format')
}

async function discoverFeeds(url: string): Promise<FeedDiscoveryResult[]> {
  const discovered: FeedDiscoveryResult[] = []

  try {
    discovered.push(...(await discoverWithFeedsearch(url)))
  } catch (error) {
    console.warn('[FeedSearch] Feedsearch discovery failed:', error)
  }

  try {
    const parsedFeed = await parseFeedUrl(url, 1)
    discovered.push({
      title: parsedFeed.title,
      description: parsedFeed.description,
      url: parsedFeed.url,
      siteUrl: parsedFeed.siteUrl,
      version: parsedFeed.version,
      format: parsedFeed.format,
      itemCount: parsedFeed.items.length,
      isPodcast: parsedFeed.isPodcast,
      source: 'direct'
    })
  } catch {
    try {
      const { body, finalUrl } = await fetchText(url)
      discovered.push(...discoverFromHtml(body, finalUrl))
    } catch (error) {
      console.warn('[FeedSearch] HTML feed autodiscovery failed:', error)
    }
  }

  return dedupeFeeds(discovered)
}

export function createFeedTool() {
  return tool({
    description:
      'Discover and read RSS 2.0, RSS 1.0 (RDF), Atom, JSON Feed, and podcast feeds. Use this for feed URLs, websites that may expose feeds, podcast feeds, Podcasting 2.0 metadata, episode lists, transcripts, chapters, funding, value blocks, and WebSub/feed metadata. Feed discovery uses feedsearch.dev plus HTML autodiscovery fallback.',
    inputSchema: feedSchema,
    async *execute(
      { action, url, max_items = 10, include_podcast_metadata = true },
      context
    ) {
      yield {
        state: 'searching' as const,
        action,
        url
      }

      let result: FeedSearchResults

      if (action === 'discover') {
        result = {
          action,
          url,
          feeds: await discoverFeeds(url),
          attribution: FEEDSEARCH_ATTRIBUTION
        }
      } else {
        const feed = await parseFeedUrl(url, max_items)
        result = {
          action,
          url,
          feed: include_podcast_metadata ? feed : omitPodcastMetadata(feed),
          attribution: FEEDSEARCH_ATTRIBUTION
        }
      }

      yield {
        state: 'complete' as const,
        ...result,
        toolCallId: context?.toolCallId
      }
    }
  })
}

export const feedTool = createFeedTool()

export type FeedUIToolInvocation = UIToolInvocation<typeof feedTool>
