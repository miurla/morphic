'use client'

import { useState } from 'react'

import { resetMemberPasswordAction } from '@/lib/actions/admin'
import type { MemberSummary } from '@/lib/auth/better-auth/members'
import { localizeErrorMessage } from '@/lib/i18n/errors'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useI18n } from '@/components/language-provider'

export function ResetMemberPasswordForm({
  members
}: {
  members: MemberSummary[]
}) {
  const { t, locale } = useI18n()
  const [userId, setUserId] = useState<string>('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const result = await resetMemberPasswordAction({
        userId,
        newPassword: password
      })

      if (result.success) {
        setSuccess(true)
        setPassword('')
      } else {
        setError(result.error ?? 'Failed to reset password')
      }
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : 'Failed to reset password'
      )
    }
    setIsSubmitting(false)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="member">{t('Member')}</Label>
        <select
          id="member"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          value={userId}
          onChange={e => setUserId(e.target.value)}
        >
          <option value="">{t('Select a member')}</option>
          {members.map(member => (
            <option key={member.id} value={member.id}>
              {member.email}
              {member.role === 'admin' ? t(' (admin)') : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-password">{t('New password')}</Label>
        <Input
          id="new-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p className="text-sm text-red-500">
          {localizeErrorMessage(locale, error)}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-600 dark:text-green-500">
          {t('Password updated.')}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting || !userId}>
        {isSubmitting ? t('Resetting...') : t('Reset password')}
      </Button>
    </form>
  )
}
