'use client'

import Link from 'next/link'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { IconLogo } from '@/components/ui/icons'

import { useI18n } from '@/components/language-provider'

export function InviteRequired() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center gap-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex flex-col items-center justify-center gap-4">
            <IconLogo className="size-12" />
            {t('Invitation required')}
          </CardTitle>
          <CardDescription>
            {t(
              'Sign-up on this Morphic instance is invite-only. Ask an administrator for an invitation link and open it to create your account.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mt-2 text-center text-sm">
            {t('Already have an account?')}{' '}
            <Link href="/auth/login" className="underline underline-offset-4">
              {t('Sign In')}
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          {t('← Back to Home')}
        </Link>
      </div>
    </div>
  )
}
