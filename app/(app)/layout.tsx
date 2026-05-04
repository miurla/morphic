import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { createClient } from '@/lib/supabase/server'

import { SidebarProvider } from '@/components/ui/sidebar'

import AppSidebar from '@/components/app-sidebar'
import ArtifactRoot from '@/components/artifact/artifact-root'
import Header from '@/components/header'
import { KeyboardShortcutHandler } from '@/components/keyboard-shortcut-handler'

export default async function AppLayout({
  children
}: {
  children: React.ReactNode
}) {
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
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <SidebarProvider defaultOpen={false}>
        {userId && <AppSidebar />}
        <KeyboardShortcutHandler />
        <div className="flex flex-col flex-1 min-w-0">
          <Header user={user} />
          <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <ArtifactRoot>{children}</ArtifactRoot>
          </main>
        </div>
      </SidebarProvider>
    </div>
  )
}
