import {
  lookup as dnsLookup,
  type LookupAddress,
  type LookupOptions
} from 'node:dns'
import { lookup as dnsLookupAsync } from 'node:dns/promises'
import { isIP, type LookupFunction } from 'node:net'
import { Agent } from 'undici'

import { BLOCKED_URL_SENTINEL } from '@/lib/errors/tool-error'

const MAX_REDIRECTS = 5
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

// Ranges that never belong to a public host: loopback, the RFC1918 space, the
// link-local block that carries cloud metadata, carrier NAT, and the reserved
// and multicast tails.
const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
]

function allowsPrivateNetwork(): boolean {
  return process.env.FETCH_ALLOW_PRIVATE_NETWORK === 'true'
}

function parseIpv4(value: string): number | null {
  const parts = value.split('.')
  if (parts.length !== 4) return null

  let result = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    result = result * 256 + octet
  }
  return result
}

function isBlockedIpv4(address: number): boolean {
  return BLOCKED_IPV4_RANGES.some(([network, bits]) => {
    const base = parseIpv4(network)
    if (base === null) return false
    const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0
    return (address & mask) >>> 0 === (base & mask) >>> 0
  })
}

// Returns the eight 16-bit groups, so a compressed address and its embedded
// IPv4 tail are compared in the same shape as a fully written one.
function expandIpv6(value: string): number[] | null {
  let address = value.split('%')[0]

  if (address.includes('.')) {
    const lastColon = address.lastIndexOf(':')
    if (lastColon === -1) return null
    const embedded = parseIpv4(address.slice(lastColon + 1))
    if (embedded === null) return null
    const high = (embedded >>> 16).toString(16)
    const low = (embedded & 0xffff).toString(16)
    address = `${address.slice(0, lastColon + 1)}${high}:${low}`
  }

  const halves = address.split('::')
  if (halves.length > 2) return null

  const toGroups = (part: string) =>
    part.length === 0 ? [] : part.split(':').map(g => Number.parseInt(g, 16))

  const head = toGroups(halves[0])
  const tail = halves.length === 2 ? toGroups(halves[1]) : []
  if (
    [...head, ...tail].some(g => !Number.isInteger(g) || g < 0 || g > 0xffff)
  ) {
    return null
  }

  if (halves.length === 1) return head.length === 8 ? head : null

  const filler = 8 - head.length - tail.length
  if (filler < 0) return null
  return [...head, ...Array(filler).fill(0), ...tail]
}

function isBlockedIpv6(value: string): boolean {
  const groups = expandIpv6(value)
  if (groups === null) return true

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups
  const embeddedV4 = (((g6 << 16) | g7) >>> 0) as number
  const leadingZeros = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0

  // ::ffff:a.b.c.d, ::a.b.c.d and the NAT64 prefix all reach an IPv4 host, so
  // they are judged as that host rather than as an IPv6 one.
  if (leadingZeros && g5 === 0xffff) return isBlockedIpv4(embeddedV4)
  if (leadingZeros && g5 === 0) {
    // Covers :: and ::1 as well, both of which fall inside 0.0.0.0/8.
    return embeddedV4 <= 1 || isBlockedIpv4(embeddedV4)
  }
  // ::ffff:0:0:0/96, which SIIT translates to the address in the last 32 bits.
  // One group over from the mapped form above, and a different prefix.
  if (
    g0 === 0 &&
    g1 === 0 &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0xffff &&
    g5 === 0
  ) {
    return isBlockedIpv4(embeddedV4)
  }
  // The whole NAT64 space rather than the well-known prefix alone: RFC 6052
  // embeds the IPv4 address at an offset that depends on the prefix length, so
  // reading it back is only right for the lengths we thought to handle. A
  // translation prefix is never a destination worth reaching on its own.
  if (g0 === 0x0064 && g1 === 0xff9b) return true

  if (g0 === 0x2001 && g1 === 0x0db8) return true // 2001:db8::/32, documentation
  if ((g0 & 0xfe00) === 0xfc00) return true // fc00::/7, unique local
  if ((g0 & 0xffc0) === 0xfe80) return true // fe80::/10, link local
  if ((g0 & 0xffc0) === 0xfec0) return true // fec0::/10, site local
  if ((g0 & 0xff00) === 0xff00) return true // ff00::/8, multicast
  return false
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) {
    const parsed = parseIpv4(address)
    return parsed === null || isBlockedIpv4(parsed)
  }
  if (family === 6) return isBlockedIpv6(address)
  return true
}

/**
 * A `net.connect` lookup that resolves the name itself and refuses the whole
 * host when any answer is private. Deciding at connect time is what closes the
 * gap a separate pre-flight check leaves open: a name can answer twice, once
 * for the check and once for the socket.
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, '', 0)
      return
    }

    const resolved = addresses as LookupAddress[]
    if (
      resolved.length === 0 ||
      resolved.some(a => isBlockedAddress(a.address))
    ) {
      callback(new Error(BLOCKED_URL_SENTINEL), '', 0)
      return
    }

    // Family autoselection asks for every address and expects the list back.
    // Answering with a single string there aborts the connection instead of
    // allowing it, which fails every name the guard was meant to let through.
    if (options.all === true) {
      callback(null, resolved)
      return
    }

    callback(null, resolved[0].address, resolved[0].family)
  })
}

let guardedAgent: Agent | undefined

function getGuardedAgent(): Agent {
  guardedAgent ??= new Agent({ connect: { lookup: guardedLookup } })
  return guardedAgent
}

/**
 * Rejects a URL that names private address space by literal. A hostname is not
 * settled here, only at connect time, so this is the pre-flight for callers
 * that hand the URL to something other than `safeFetch`.
 */
export function assertPublicUrl(value: string): void {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(BLOCKED_URL_SENTINEL)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(BLOCKED_URL_SENTINEL)
  }
  if (allowsPrivateNetwork()) return

  // A literal is settled here; a name is settled by the lookup above.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
  if (isIP(hostname) !== 0 && isBlockedAddress(hostname)) {
    throw new Error(BLOCKED_URL_SENTINEL)
  }
}

/**
 * The resolving counterpart of `assertPublicUrl`, for a URL that is about to
 * be handed to an extraction service rather than requested here. Those
 * requests leave from the service, so this is not about reaching our own
 * network: it is about not making Morphic the thing that points a third party
 * at private space.
 */
export async function assertResolvedPublicUrl(value: string): Promise<void> {
  assertPublicUrl(value)
  if (allowsPrivateNetwork()) return

  const hostname = new URL(value).hostname.replace(/^\[|\]$/g, '')
  if (isIP(hostname) !== 0) return

  let addresses: LookupAddress[]
  try {
    addresses = await dnsLookupAsync(hostname, { all: true })
  } catch {
    throw new Error(BLOCKED_URL_SENTINEL)
  }

  if (
    addresses.length === 0 ||
    addresses.some(a => isBlockedAddress(a.address))
  ) {
    throw new Error(BLOCKED_URL_SENTINEL)
  }
}

interface SafeFetchInit {
  headers?: Record<string, string>
  signal?: AbortSignal
}

// `dispatcher` is undici's, which the platform fetch reads but does not
// declare.
type DispatchedInit = RequestInit & { dispatcher?: Agent }

/**
 * The refusal raised inside the lookup reaches the caller wrapped, with the
 * sentinel buried in the cause chain, where the failure classifier cannot see
 * it and reports a generic retryable error instead.
 */
function isBlockedError(error: unknown): boolean {
  let current: unknown = error

  for (let depth = 0; depth < 5; depth++) {
    if (!(current instanceof Error)) return false
    if (current.message === BLOCKED_URL_SENTINEL) return true
    current = current.cause
  }
  return false
}

/**
 * Fetch that refuses private address space, on the first request and on every
 * redirect it is asked to follow. Redirects are taken by hand because the
 * automatic ones are followed inside the platform, where the destination is
 * never offered for inspection.
 */
export async function safeFetch(
  url: string,
  init: SafeFetchInit = {}
): Promise<Response> {
  let target = url

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertPublicUrl(target)

    let response: Response
    try {
      response = await fetch(target, {
        ...init,
        redirect: 'manual',
        ...(allowsPrivateNetwork() ? {} : { dispatcher: getGuardedAgent() })
      } as DispatchedInit)
    } catch (error) {
      if (isBlockedError(error)) throw new Error(BLOCKED_URL_SENTINEL)
      throw error
    }

    const location = response.headers.get('location')
    if (!REDIRECT_STATUSES.has(response.status) || !location) return response

    await response.body?.cancel().catch(() => {})
    target = new URL(location, target).toString()
  }

  throw new Error(`Too many redirects: ${url}`)
}
