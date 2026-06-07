import type { Metadata, Viewport } from 'next'
import { Inter as FontSans } from 'next/font/google'

import { Analytics } from '@vercel/analytics/next'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { UserProvider } from '@/lib/contexts/user-context'
import { buildPlatformInfo } from '@/lib/platform/platform'
import { hasSupabasePublicConfig } from '@/lib/supabase/keys'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'

import AppSidebar from '@/components/app-sidebar'
import ArtifactRoot from '@/components/artifact/artifact-root'
import Header from '@/components/header'
import { KeyboardShortcutHandler } from '@/components/keyboard-shortcut-handler'
import { NativeEnvironmentProvider } from '@/components/native/native-environment-provider'
import { ServiceWorkerRegister } from '@/components/native/service-worker-register'
import { PlatformProvider } from '@/components/platform/platform-provider'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'
import './native-shell.css'

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans'
})

const title = 'Morphic'
const description =
  'A fully open-source AI-powered answer engine with a generative UI.'
const ssrPlatformClasses = buildPlatformInfo().classes.join(' ')

export const metadata: Metadata = {
  metadataBase: new URL('https://morphic.sh'),
  title,
  description,
  applicationName: title,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-any.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: [{ url: '/icons/icon-any.svg', type: 'image/svg+xml' }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title
  },
  formatDetection: {
    telephone: false
  },
  openGraph: {
    title,
    description
  },
  twitter: {
    title,
    description,
    card: 'summary_large_image',
    creator: '@miiura'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ]
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  let user = null

  if (hasSupabasePublicConfig()) {
    const supabase = await createClient()
    const {
      data: { user: supabaseUser }
    } = await supabase.auth.getUser()
    user = supabaseUser
  }

  const userId = user?.id ?? (await getCurrentUserId())

  return (
    <html lang="en" className={ssrPlatformClasses} suppressHydrationWarning>
      <body
        className={cn(
          'fixed inset-0 flex flex-col font-sans antialiased overflow-hidden app-shell',
          fontSans.variable
        )}
      >
        <PlatformProvider>
          <NativeEnvironmentProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <UserProvider hasUser={!!userId}>
                <SidebarProvider defaultOpen={false}>
                  {userId && <AppSidebar />}
                  <KeyboardShortcutHandler />
                  <ServiceWorkerRegister />
                  <div className="flex flex-col flex-1 min-w-0 native-app-frame">
                    <Header user={user} />
                    <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden native-app-main">
                      <ArtifactRoot>{children}</ArtifactRoot>
                    </main>
                  </div>
                </SidebarProvider>
              </UserProvider>
              <Toaster />
              <Analytics />
            </ThemeProvider>
          </NativeEnvironmentProvider>
        </PlatformProvider>
      </body>
    </html>
  )
}
