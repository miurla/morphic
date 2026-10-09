'use client'

import { useEffect, useState } from 'react'

import {
  createInvitationAction,
  getServerTime,
  type InvitationView,
  revokeInvitationAction
} from '@/lib/actions/admin'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function InvitationsManager({
  invitations: initialInvitations,
  serverNow
}: {
  invitations: InvitationView[]
  serverNow?: string
}) {
  const [invitations, setInvitations] = useState(initialInvitations)
  // The server-computed `expired` flag goes stale while the page stays
  // open. A state clock (never read from Date during render) re-evaluates
  // expirations every minute, so an elapsed link is caught within a
  // minute. The clock is corrected for the offset between the local
  // clock and the server: a browser running fast cannot hide the Revoke
  // button of a still-live invitation (or running behind keep showing an
  // expired one as active). The render-time snapshot cannot tell clock
  // drift from the delay before hydration, so a fresh round-trip sample
  // re-estimates the offset once the page is live.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    // The gap between server render and hydration (slow devices, tabs
    // backgrounded before hydration) is indistinguishable from clock
    // drift in the snapshot, so it is only a provisional estimate: the
    // round-trip sample below replaces it as soon as it lands.
    const rawSkew = serverNow ? Date.now() - new Date(serverNow).getTime() : 0
    // Sub-minute errors cannot change an outcome evaluated once a
    // minute, so only drift larger than the tick is corrected.
    let skew = Math.abs(rawSkew) < 60_000 ? 0 : rawSkew
    const tick = () => setNow(Date.now() - skew)
    tick()
    const timer = setInterval(tick, 60_000)
    // NTP-style midpoint: the response arrives halfway through the
    // round-trip on average, so the estimate's error is bounded by half
    // the (small, post-hydration) round-trip instead of the unbounded
    // pre-hydration delay baked into the snapshot. Without this, a tab
    // backgrounded for minutes before hydration pins the clock to the
    // render time and keeps expired invitations shown as Active.
    const t0 = Date.now()
    getServerTime()
      .then(serverTime => {
        if (cancelled || typeof serverTime !== 'number') {
          return
        }
        const offset = t0 + (Date.now() - t0) / 2 - serverTime
        skew = Math.abs(offset) < 60_000 ? 0 : offset
        setNow(Date.now() - skew)
      })
      .catch(() => {
        // Sample failed: keep the snapshot-derived estimate.
      })
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [serverNow])
  const isExpired = (invitation: InvitationView) =>
    invitation.expired ||
    (now !== null && new Date(invitation.expiresAt).getTime() <= now)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError(null)
    setNewLink(null)

    try {
      const result = await createInvitationAction({ email })
      if (result.success && result.invitation) {
        setInvitations(current => [result.invitation!, ...current])
        setNewLink(result.link ?? null)
        setEmail('')
      } else {
        setError(result.error ?? 'Failed to create invitation')
      }
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : 'Failed to create invitation'
      )
    }
    setIsCreating(false)
  }

  const handleRevoke = async (id: string) => {
    setError(null)
    let result
    try {
      result = await revokeInvitationAction(id)
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : 'Failed to revoke invitation'
      )
      return
    }
    if (result.success) {
      setInvitations(current =>
        current.map(invitation =>
          invitation.id === id ? { ...invitation, revoked: true } : invitation
        )
      )
    } else {
      setError(result.error ?? 'Failed to revoke invitation')
    }
  }

  const handleCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed — select the link and copy manually.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleCreate}>
        <Input
          type="email"
          placeholder="invitee@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <Button type="submit" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create invitation'}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Each invitation is single-use and can only be redeemed by this address.
      </p>

      {newLink && (
        <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
          <Input readOnly value={newLink} className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            onClick={() => handleCopy(newLink)}
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <ul className="flex flex-col gap-2">
        {invitations.length === 0 && (
          <li className="text-sm text-muted-foreground">No invitations yet.</li>
        )}
        {invitations.map(invitation => (
          <li
            key={invitation.id}
            className="flex flex-col gap-1 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                {invitation.email ?? 'No email specified'}
              </span>
              <span className="text-xs text-muted-foreground">
                Expires {new Date(invitation.expiresAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {invitation.used ? (
                <Badge variant="secondary">Used</Badge>
              ) : invitation.revoked ? (
                <Badge variant="destructive">Revoked</Badge>
              ) : isExpired(invitation) ? (
                <Badge variant="outline">Expired</Badge>
              ) : (
                <Badge>Active</Badge>
              )}
              {!invitation.revoked &&
                !invitation.used &&
                !isExpired(invitation) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRevoke(invitation.id)}
                  >
                    Revoke
                  </Button>
                )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
