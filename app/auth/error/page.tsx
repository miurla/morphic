import { getI18n } from '@/lib/i18n/server'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ error: string }>
}) {
  const { t } = await getI18n()
  const params = await searchParams

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {t('Sorry, something went wrong.')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {params?.error ? (
                <p className="text-sm text-muted-foreground">
                  {t('Code error: {code}', { code: params.error })}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('An unspecified error occurred.')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
