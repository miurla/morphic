import { getI18n } from '@/lib/i18n/server'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

export default async function Page() {
  const { t } = await getI18n()
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {t('Thank you for signing up!')}
              </CardTitle>
              <CardDescription>
                {t('Check your email to confirm')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t(
                  "You've successfully signed up. Please check your email to confirm your account before signing in."
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
