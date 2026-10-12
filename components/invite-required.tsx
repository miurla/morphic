import Link from 'next/link'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { IconLogo } from '@/components/ui/icons'

export function InviteRequired() {
  return (
    <div className="flex flex-col items-center gap-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex flex-col items-center justify-center gap-4">
            <IconLogo className="size-12" />
            Invitation required
          </CardTitle>
          <CardDescription>
            Sign-up on this Morphic instance is invite-only. Ask an
            administrator for an invitation link and open it to create your
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mt-2 text-center text-sm">
            Already have an account?{' '}
            <Link href="/auth/login" className="underline underline-offset-4">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          &larr; Back to Home
        </Link>
      </div>
    </div>
  )
}
