import { Suspense } from 'react'

import { LoginForm } from '@/components/login-form'

export default function Page() {
  return (
    <div className="flex min-h-svh w-full">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground text-background flex-col justify-between p-12">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Melron</h2>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            Votre assistant
            <br />
            carrière intelligent
          </h1>
          <p className="text-background/60 text-lg max-w-md">
            Recherche d&apos;emploi, networking LinkedIn, et suivi de
            candidatures — propulsé par l&apos;IA.
          </p>
        </div>
        <p className="text-background/40 text-sm">
          Propulsé par Melron
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
