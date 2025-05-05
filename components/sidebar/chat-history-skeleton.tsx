import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton
} from '@/components/ui/sidebar'

export function ChatHistorySkeleton() {
  return (
    <SidebarMenu>
      {Array.from({ length: 5 }).map((_, idx) => (
        <SidebarMenuItem key={idx}>
          <SidebarMenuSkeleton showIcon={false} />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
