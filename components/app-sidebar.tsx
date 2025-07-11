import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger
} from '@/components/ui/sidebar'
import { Building2, FileText, Plus, Shield, Users } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { ChatHistorySection } from './sidebar/chat-history-section'
import { ChatHistorySkeleton } from './sidebar/chat-history-skeleton'

export default function AppSidebar() {
  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="flex flex-row justify-between items-center">
        <Link href="/" className="flex items-center gap-2 px-2 py-3">
          <Image
            src="/images/local825-logo.png"
            alt="Local 825 Logo"
            width={32}
            height={32}
            className="rounded-md"
          />
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Bulldozer Search</span>
            <span className="text-xs text-muted-foreground">Local 825</span>
          </div>
        </Link>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent className="flex flex-col px-2 py-4 h-full">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/" className="flex items-center gap-2">
                <Plus className="size-4" />
                <span>New Research</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Quick Research Categories */}
        <div className="px-2 py-2">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">
            Quick Research
          </h3>
          <div className="space-y-1">
            <Link
              href="/?q=OSHA violations"
              className="flex items-center gap-2 p-2 text-sm rounded-md hover:bg-accent"
            >
              <Shield className="size-4" />
              <span>Safety & OSHA</span>
            </Link>
            <Link
              href="/?q=government contracts"
              className="flex items-center gap-2 p-2 text-sm rounded-md hover:bg-accent"
            >
              <FileText className="size-4" />
              <span>Government Contracts</span>
            </Link>
            <Link
              href="/?q=union status"
              className="flex items-center gap-2 p-2 text-sm rounded-md hover:bg-accent"
            >
              <Users className="size-4" />
              <span>Union Relations</span>
            </Link>
            <Link
              href="/?q=company analysis"
              className="flex items-center gap-2 p-2 text-sm rounded-md hover:bg-accent"
            >
              <Building2 className="size-4" />
              <span>Company Analysis</span>
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<ChatHistorySkeleton />}>
            <ChatHistorySection />
          </Suspense>
        </div>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
