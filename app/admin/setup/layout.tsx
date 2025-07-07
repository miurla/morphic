export default function AdminSetupLayout({
  children
}: {
  children: React.ReactNode
}) {
  // This layout doesn't require admin access since it's for setting up admin
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
