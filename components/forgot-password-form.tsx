'use client'

import { cn } from '@/lib/utils/index'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useState } from 'react'

export function ForgotPasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Password Reset</CardTitle>
          <CardDescription>
            Password reset is not available in this demo version
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This application uses a simplified authentication system for demonstration purposes. 
            Password reset functionality would require email configuration in a production environment.
          </p>
          <div className="flex justify-center">
            <Link href="/auth/signin">
              <Button variant="outline">Back to Sign In</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
