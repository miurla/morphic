import { getCurrentUser } from '@/lib/auth/get-current-user'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  
  // Check if user is admin (you can modify this logic based on your admin system)
  const isAdmin = user?.user_metadata?.role === 'admin' || 
                  user?.email === process.env.ADMIN_EMAIL ||
                  user?.user_metadata?.admin === true

  if (!user || !isAdmin) {
    redirect('/auth/login?redirect=/admin')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Educational Platform Admin</h1>
            <div className="text-sm text-muted-foreground">
              Logged in as: {user.email}
            </div>
          </div>
        </div>
      </div>
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
