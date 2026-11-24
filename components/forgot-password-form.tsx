'use client'

import { useState } from 'react'
import Link from 'next/link'

import { requestPasswordReset } from '@/lib/actions/auth'
import { localizeErrorMessage } from '@/lib/i18n/errors'
import { cn } from '@/lib/utils/index'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useI18n } from '@/components/language-provider'

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const { t, locale } = useI18n()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await requestPasswordReset(email)
      if (!result.success) throw new Error(result.error ?? 'An error occurred')
      setSuccess(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      {success ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('Check Your Email')}</CardTitle>
            <CardDescription>
              {t('Password reset instructions sent')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t(
                'If you registered using your email and password, you will receive a password reset email.'
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {t('Reset Your Password')}
            </CardTitle>
            <CardDescription>
              {t(
                "Type in your email and we'll send you a link to reset your password"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">{t('Email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-500">
                    {localizeErrorMessage(locale, error)}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('Sending...') : t('Send reset email')}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                {t('Already have an account?')}{' '}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  {t('Login')}
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
