export default function MarketingLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden bg-background text-foreground">
      {children}
    </div>
  )
}
