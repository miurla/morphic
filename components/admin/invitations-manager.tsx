'use client'

import { useState } from 'react'

import {
  createInvitationAction,
  type InvitationView,
  revokeInvitationAction
} from '@/lib/actions/admin'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function InvitationsManager({
  invitations: initialInvitations
}: {
  invitations: InvitationView[]
}) {
  const [invitations, setInvitations] = useState(initialInvitations)
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

    const result = await createInvitationAction({ email })
    if (result.success && result.invitation) {
      setInvitations(current => [result.invitation!, ...current])
      setNewLink(result.link ?? null)
      setEmail('')
    } else {
      setError(result.error ?? 'Failed to create invitation')
    }
    setIsCreating(false)
  }

  const handleRevoke = async (id: string) => {
    setError(null)
    const result = await revokeInvitationAction(id)
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
              ) : invitation.expired ? (
                <Badge variant="outline">Expired</Badge>
              ) : (
                <Badge>Active</Badge>
              )}
              {!invitation.revoked &&
                !invitation.used &&
                !invitation.expired && (
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
