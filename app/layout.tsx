import { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import { Inter as FontSans } from 'next/font/google'

import { Analytics } from '@vercel/analytics/next'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { UserProvider } from '@/lib/contexts/user-context'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'

import AppSidebar from '@/components/app-sidebar'
import ArtifactRoot from '@/components/artifact/artifact-root'
import { AuthModalProvider } from '@/components/auth-modal'
import Header from '@/components/header'
import { KeyboardShortcutHandler } from '@/components/keyboard-shortcut-handler'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans'
})

const title = 'Melron'
const description =
  'Votre assistant carrière intelligent — recherche d\'emploi, networking et suivi propulsés par l\'IA.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description
  },
  twitter: {
    title,
    description,
    card: 'summary_large_image'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  let user = null
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = await createClient()
    const {
      data: { user: supabaseUser }
    } = await supabase.auth.getUser()
    user = supabaseUser
  }

  const userId = user?.id ?? (await getCurrentUserId())

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'font-sans antialiased',
          userId
            ? 'fixed inset-0 flex flex-col overflow-hidden'
            : 'min-h-screen flex flex-col',
          fontSans.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <UserProvider hasUser={!!userId}>
            <Suspense>
              <AuthModalProvider>
                {userId ? (
                  <SidebarProvider defaultOpen={true}>
                    <AppSidebar user={user} />
                    <KeyboardShortcutHandler />
                    <div className="flex flex-col flex-1 min-w-0">
                      <Header user={user} />
                      <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
                        <ArtifactRoot>{children}</ArtifactRoot>
                      </main>
                    </div>
                  </SidebarProvider>
                ) : (
                  <SidebarProvider defaultOpen={false}>
                    <main className="flex flex-1 flex-col min-w-0">
                      {children}
                    </main>
                  </SidebarProvider>
                )}
              </AuthModalProvider>
            </Suspense>
          </UserProvider>
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
