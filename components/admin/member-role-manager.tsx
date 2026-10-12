'use client'

import { useState } from 'react'

import { promoteMemberAction } from '@/lib/actions/admin'
import type { MemberSummary } from '@/lib/auth/better-auth/members'

import { Button } from '@/components/ui/button'

export function MemberRoleManager({ members }: { members: MemberSummary[] }) {
  const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const promote = async (userId: string) => {
    setBusyId(userId)
    setError(null)
    try {
      const result = await promoteMemberAction({ userId })
      if (result.success) {
        setPromotedIds(prev => new Set(prev).add(userId))
      } else {
        setError(result.error ?? 'Failed to promote member')
      }
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : 'Failed to promote member'
      )
    }
    setBusyId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {members.map(member => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-4"
          >
            <span className="truncate text-sm">
              {member.email}
              {member.role === 'admin' ? ' (admin)' : ''}
            </span>
            {member.role === 'admin' ? (
              <span className="text-xs text-muted-foreground">Admin</span>
            ) : promotedIds.has(member.id) ? (
              <span className="text-xs text-muted-foreground">Promoted</span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={busyId !== null}
                onClick={() => promote(member.id)}
              >
                {busyId === member.id ? 'Promoting...' : 'Promote to admin'}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
